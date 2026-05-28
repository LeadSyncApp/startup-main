import { prisma } from "../../lib/prisma";
import { TelegramAdapter } from "../../adapters/telegram.adapter";
import { TelegramLeaseService, MY_ROLE, INSTANCE_ID } from "./telegramSelector.service";
import axios from "axios";

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
      // Find all companies with connected Telegram bots
      const companies = await prisma.company.findMany({
        where: {
          telegramBotToken: { not: null },
          telegramConnected: true
        }
      });

      for (const company of companies) {
        // Enforce centralized primary/passive consumer selection lease
        const authorized = await TelegramLeaseService.isAuthorizedToConsume(company.id);
        if (!authorized) {
          continue;
        }

        const token = company.telegramBotToken!;
        
        // 1. Delete webhook if we haven't done so for this session
        if (offsets[token] === undefined) {
          try {
            console.log(`🧹 Deleting webhook for bot @${company.telegramBotUsername || "bot"} to enable polling...`);
            await axios.post(`https://api.telegram.org/bot${token}/deleteWebhook`, {
              drop_pending_updates: true
            });
            offsets[token] = 0; // initialize offset
            // Safety delay to let Telegram process webhook deletion
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (err: any) {
            console.error(`⚠️ Failed to delete webhook for bot @${company.telegramBotUsername || "bot"}:`, err.message);
            continue;
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
            const adapter = new TelegramAdapter(token);

            for (const update of updates) {
              console.log(`📥 [Polling Telegram Update] received update_id: ${update.update_id} for bot @${company.telegramBotUsername || "bot"}`);
              
              // Process update using existing adapter logic
              try {
                await adapter.processWebhook(update, company.id);
              } catch (procErr) {
                console.error("❌ Error processing polled update:", procErr);
              }

              // Advance offset
              offsets[token] = update.update_id + 1;
            }
          }
        } catch (fetchErr: any) {
          if (fetchErr.code !== "ECONNABORTED") {
            const isConflict = fetchErr.response?.status === 409;
            if (isConflict) {
              console.warn(
                `ℹ️ [Polling] Telegram getUpdates returned 409 Conflict for @${company.telegramBotUsername || "bot"}. ` +
                `This means a webhook is active or another polling instance of this bot is running. ` +
                `Setting offset back to retry webhook cleanup...`
              );
              offsets[token] = undefined; // Force a delete webhook retry on next loop
              // Wait slightly longer in case of conflict to avoid spamming the logs
              await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
              console.error(`⚠️ Telegram getUpdates error for @${company.telegramBotUsername || "bot"}:`, fetchErr.message);
            }
          }
        }
      }
    } catch (globalErr: any) {
      console.error("❌ Global Telegram Polling Error:", globalErr.message);
    } finally {
      // Schedule next poll ONLY after this iteration has fully completed
      setTimeout(poll, 1500);
    }
  };

  // Kick off polling with a short delay
  setTimeout(poll, 3000);
}
