import { prisma } from "../../lib/prisma";
import { ProviderAdapterFactory } from "../../adapters/provider.factory";
import { TelegramLeaseService, MY_ROLE, INSTANCE_ID, IS_LOCAL } from "./telegramSelector.service";
import axios from "axios";
import { taskTracker } from "../infrastructure/taskTracker";
import { webhookPersistenceService } from "../infrastructure/webhookPersistence.service";
import { pgBossService } from "../infrastructure/pgboss/pgboss.service";
import { decryptSecret } from "../../utils/encryption";
import { idempotencyService } from "../infrastructure/idempotency.service";

declare global {
  var isTelegramPollingStarted: boolean | undefined;
}

export async function startTelegramPolling() {
  if (process.env.TELEGRAM_POLLING !== "true") {
    console.log("ℹ️ Telegram Polling is disabled. Webhook-mode will be used.");
    return;
  }

  if (global.isTelegramPollingStarted) {
    console.log("ℹ️ Telegram Polling is already running. Skipping initialization to prevent conflict.");
    return;
  }

  global.isTelegramPollingStarted = true;
  console.log(`⚡ Starting Telegram Polling Service (${MY_ROLE} role)...`);

  // Start heartbeat loop of the master lease manager
  TelegramLeaseService.startHeartbeatLoop();

  // Keep track of offsets per bot token
  const offsets: { [token: string]: number | undefined } = {};

  // Run the polling query in a loop
  const poll = async () => {
    try {
      // Fail-safe: if local dev and MY_BOT_USERNAME is not configured, poll nothing.
      if (IS_LOCAL && !process.env.MY_BOT_USERNAME) {
        setTimeout(poll, 500);
        return;
      }

      // Single query for both polling and duplicate detection (eliminates O(N) round trip to Seoul)
      const allActiveBots = await prisma.company.findMany({
        where: {
          telegramBotToken: { not: null },
          telegramConnected: true,
          ...(IS_LOCAL ? { telegramBotUsername: process.env.MY_BOT_USERNAME } : {})
        },
        select: {
          id: true,
          name: true,
          telegramBotToken: true,
          telegramBotUsername: true,
          telegramConnected: true
        }
      });

      const tokenToCompanies: { [decryptedToken: string]: typeof allActiveBots } = {};
      const duplicateCompanyIds = new Set<string>();

      for (const bot of allActiveBots) {
        const decrypted = decryptSecret(bot.telegramBotToken);
        if (decrypted) {
          if (!tokenToCompanies[decrypted]) {
            tokenToCompanies[decrypted] = [];
          }
          tokenToCompanies[decrypted].push(bot);
        }
      }

      for (const [_, bots] of Object.entries(tokenToCompanies)) {
        if (bots.length > 1) {
          const companyList = bots.map(b => `'${b.name}' (${b.id})`).join(", ");
          console.error(`🚨 [CRITICAL CONFIGURATION ERROR] Telegram bot token is configured across MULTIPLE companies: ${companyList}. Polling for these companies is disabled to prevent message misrouting.`);
          bots.forEach(b => duplicateCompanyIds.add(b.id));
        }
      }

      // Derive the polling list from the same query result (reuse `name` for logging too)
      const companies = allActiveBots;
      const activeCompanies = companies.filter(c => !duplicateCompanyIds.has(c.id));

      // 🛑 FIX: Parallelize polling across all companies instead of sequential.
      // Each company's poll cycle runs independently via Promise.all.
      // This eliminates the N*(1s webhook cleanup + fetch + process) bottleneck.
      await Promise.all(activeCompanies.map(async (company) => {
        // Enforce centralized primary/passive consumer selection lease
        const authorized = await TelegramLeaseService.isAuthorizedToConsume(company.id);
        if (!authorized) {
          return;
        }

        const token = decryptSecret(company.telegramBotToken);
        if (!token) {
          console.error(`⚠️ Could not decrypt bot token for @${company.telegramBotUsername || "bot"}. Skipping company ${company.id}.`);
          return;
        }
        
        // 1. Delete webhook if we haven't done so for this session
        if (offsets[token] === undefined) {
          try {
            console.log(`🧹 Deleting webhook for bot @${company.telegramBotUsername || "bot"} to enable polling (dropping stale pending updates)...`);
            await axios.post(`https://api.telegram.org/bot${token}/deleteWebhook`, {
              drop_pending_updates: true
            });
            offsets[token] = 0; // initialize offset
            // Safety delay to let Telegram process webhook deletion
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (err: any) {
            const is401 = err.response?.status === 401 || err.response?.data?.error_code === 401 || err.message?.includes("401");
            if (is401) {
              await prisma.company.update({
                where: { id: company.id },
                data: { telegramConnected: false }
              }).catch(() => {});
              console.warn(`⚠️ Bot token for ${company.telegramBotUsername || company.id} was rejected by Telegram (401) — marking telegramConnected: false. Reconnect via the UI with a valid token to restore.`);
              return;
            }
            console.error(`⚠️ Failed to delete webhook for bot @${company.telegramBotUsername || "bot"}:`, err.message);
            return;
          }
        }

        const offset = offsets[token];

        // 2. Fetch updates
        try {
          const res = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`, {
            params: {
              offset: offset > 0 ? offset : undefined,
              timeout: 1, // short timeout for responsiveness
              limit: 10
            },
            timeout: 5000
          });

          if (res.data?.ok && res.data?.result?.length > 0) {
            const updates = res.data.result;

            for (const update of updates) {
              const updateId = String(update.update_id);
              const lockKey = `telegram:update:${company.id}:${updateId}`;
              const acquired = await idempotencyService.acquireProcessingLock(lockKey, 86400).catch(() => true);
              if (!acquired) {
                console.log(`🛡️ [Polling Telegram] Skipping duplicate/stale update_id ${updateId} for bot @${company.telegramBotUsername || "bot"}`);
                offsets[token] = update.update_id + 1;
                continue;
              }

              console.log(`📥 [Polling Telegram Update] received update_id: ${update.update_id} for bot @${company.telegramBotUsername || "bot"}`);
              
              // Process update using existing adapter logic
              const processPromise = (async () => {
                let webhookRecord: any = null;
                try {
                  webhookRecord = await webhookPersistenceService.persist(
                    "TELEGRAM",
                    company.id,
                    String(update.update_id),
                    update
                  );

                  const adapter = ProviderAdapterFactory.getAdapter("telegram");
                  const standardizedFrame = adapter.normalizePayload(update);

                  if (standardizedFrame) {
                    standardizedFrame.companyId = company.id;
                    standardizedFrame.contactName = update.message?.from?.first_name || update.callback_query?.from?.first_name || "User";
                    standardizedFrame.callbackData = update.callback_query?.data;

                    if (process.env.DEBUG_LATENCY === "true") {
                      standardizedFrame._enqueuedAt = Date.now();
                      console.log(`⏱️ [DEBUG_LATENCY Stage 7] Telegram update ${update.update_id} enqueued at ${standardizedFrame._enqueuedAt}`);
                    }

                    const boss = pgBossService.getBoss();
                    await boss.send("webhook.process", standardizedFrame);
                  }

                  if (webhookRecord) {
                    await webhookPersistenceService.markProcessed(webhookRecord.id);
                  }
                } catch (procErr: any) {
                  console.error("❌ Error processing polled update:", procErr);
                  if (webhookRecord) {
                    await webhookPersistenceService.markFailed(webhookRecord.id, procErr?.message || String(procErr));
                  }
                }
              })();

              taskTracker.track(processPromise);

              // Advance offset
              offsets[token] = update.update_id + 1;
            }
          }
        } catch (fetchErr: any) {
          const is401 = fetchErr.response?.status === 401 || fetchErr.response?.data?.error_code === 401 || fetchErr.message?.includes("401");
          if (is401) {
            await prisma.company.update({
              where: { id: company.id },
              data: { telegramConnected: false }
            }).catch(() => {});
            console.warn(`⚠️ Bot token for ${company.telegramBotUsername || company.id} was rejected by Telegram (401) — marking telegramConnected: false. Reconnect via the UI with a valid token to restore.`);
            return;
          }
          if (fetchErr.code !== "ECONNABORTED") {
            const isConflict = fetchErr.response?.status === 409;
            if (isConflict) {
              console.warn(
                `ℹ️ [Polling] Telegram getUpdates returned 409 Conflict for @${company.telegramBotUsername || "bot"}. ` +
                `This means a webhook is active or another polling instance of this bot is running. ` +
                `Setting offset back to retry webhook cleanup...`
              );
              offsets[token] = undefined; // Force a delete webhook retry on next loop
            } else {
              console.error(`⚠️ Telegram getUpdates error for @${company.telegramBotUsername || "bot"}:`, fetchErr.message);
            }
          }
        }
      }));
    } catch (globalErr: any) {
      console.error("❌ Global Telegram Polling Error:", globalErr.message);
    } finally {
      // Schedule next poll ONLY after this iteration has fully completed
      setTimeout(poll, 500);
    }
  };

  // Kick off polling with a short delay
  setTimeout(poll, 3000);
}
