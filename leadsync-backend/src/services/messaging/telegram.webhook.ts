import { prisma } from "../../lib/prisma";
import axios from "axios";
import crypto from "crypto";
import { encrypt, decryptSecret } from "../../utils/encryption";

export async function registerTelegramWebhook(
  botToken: string,
  webhookSecret: string
): Promise<any> {
  const apiBaseUrl = process.env.API_BASE_URL;

  if (!apiBaseUrl || apiBaseUrl.includes("localhost") || apiBaseUrl.includes("127.0.0.1")) {
    console.warn(`⚠️ Skipping Telegram webhook registration: API_BASE_URL is not public (${apiBaseUrl})`);
    return { ok: false, description: "Not a public URL" };
  }

  const webhookUrl = `${apiBaseUrl}/api/webhook/telegram/webhook`;
  const telegramUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;

  console.log(`🌐 Registering webhook to Telegram: ${webhookUrl}`);

  try {
    const response = await axios.post(telegramUrl, {
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["message", "callback_query"]
    });

    if (!response.data || !response.data.ok) {
      throw new Error(`Failed to register webhook: ${JSON.stringify(response.data)}`);
    }

    return response.data;
  } catch (error: any) {
    console.error("❌ Telegram setWebhook request failed:", error.response?.data || error.message);
    throw error;
  }
}

export async function initializeTelegramWebhooks() {
  if (process.env.TELEGRAM_POLLING === "true") {
    console.log("ℹ️ [Telegram Webhooks] TELEGRAM_POLLING=true. Skipping webhook registration to enforce single delivery mode.");
    return;
  }
  console.log("⚙️ [Telegram Webhooks] Initializing event-driven webhooks for all connected bots...");
  console.log(`📋 [Telegram Webhooks] API_BASE_URL=${process.env.API_BASE_URL}`);
  console.log(`📋 [Telegram Webhooks] NODE_ENV=${process.env.NODE_ENV}`);
  console.log(`📋 [Telegram Webhooks] ENCRYPTION_KEY set=${!!process.env.ENCRYPTION_KEY} len=${process.env.ENCRYPTION_KEY?.length}`);

  try {
    const companies = await prisma.company.findMany({
      where: {
        telegramConnected: true,
        telegramBotToken: { not: null }
      }
    });

    console.log(`🔎 Found ${companies.length} connected company bots.`);

    for (const company of companies) {
      try {
        let decryptedToken: string | null = null;
        try {
          decryptedToken = decryptSecret(company.telegramBotToken);
        } catch (decryptErr: any) {
          console.error(`❌ Failed to decrypt bot token for company: ${company.name} — ${decryptErr.message}. Skipping.`);
          continue;
        }

        if (!decryptedToken) {
          console.error(`❌ Bot token is null/empty for company: ${company.name}. Skipping.`);
          continue;
        }
        const token = decryptedToken;

        let secret: string | null = null;
        try {
          secret = decryptSecret(company.telegramWebhookSecret);
        } catch (decryptErr: any) {
          console.error(`❌ Failed to decrypt webhook secret for company: ${company.name} — ${decryptErr.message}. Generating new secret.`);
        }

        // Ensure secret exists
        if (!secret) {
          secret = crypto.randomBytes(32).toString("hex");
          await prisma.company.update({
            where: { id: company.id },
            data: { telegramWebhookSecret: encrypt(secret) }
          });
          console.log(`🔑 Generated new telegramWebhookSecret for company: ${company.name}`);
        }

        // Register webhook with Telegram API
        const result = await registerTelegramWebhook(token, secret);
        if (result?.ok) {
          console.log(`✅ [Webhook Registered] Connected bot @${company.telegramBotUsername || "bot"} (Company: ${company.name})`);
        } else {
          console.log(`⏭️  [Webhook Skipped] @${company.telegramBotUsername || "bot"} (Company: ${company.name}) — API_BASE_URL not public, using polling`);
        }

        // Sync commands just in case to ensure perfect setup
        const existingConfig = await prisma.botConfiguration.findUnique({
          where: { companyId: company.id }
        });

        const commands = (existingConfig?.botCommands as any) || [
          { command: "start", description: "Start the bot" },
          { command: "help", description: "Get support" }
        ];

        await axios.post(`https://api.telegram.org/bot${token}/setMyCommands`, {
          commands: commands.map((c: any) => ({
            command: c.command.toLowerCase().trim(),
            description: c.description.trim()
          }))
        });

        await axios.post(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
          menu_button: { type: "commands" }
        });

      } catch (botErr: any) {
        const is401 = botErr.response?.status === 401 || botErr.response?.data?.error_code === 401 || botErr.message?.includes("401");
        if (is401) {
          await prisma.company.update({
            where: { id: company.id },
            data: { telegramConnected: false }
          }).catch(() => {});
          console.warn(`⚠️ Bot token for ${company.name} was rejected by Telegram (401) — marking telegramConnected: false. Reconnect via the UI with a valid token to restore.`);
        } else {
          console.error(`❌ Failed to register/sync bot @${company.telegramBotUsername || "bot"} (Company: ${company.name}):`, botErr.message);
        }
      }
    }
  } catch (err: any) {
    console.error("❌ Failed to run initializeTelegramWebhooks:", err.message);
  }
}
