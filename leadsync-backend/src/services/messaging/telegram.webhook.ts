import { prisma } from "../../lib/prisma";
import axios from "axios";
import crypto from "crypto";
import { decryptSecret } from "../../utils/encryption";

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
  console.log("⚙️ [Telegram Webhooks] Initializing event-driven webhooks for all connected bots...");

  try {
    const companies = await prisma.company.findMany({
      where: {
        telegramConnected: true,
        telegramBotToken: { not: null },
        isTest: false
      }
    });

    console.log(`🔎 Found ${companies.length} connected company bots.`);

    for (const company of companies) {
      const decryptedToken = decryptSecret(company.telegramBotToken);
      if (!decryptedToken) {
        console.error(`❌ Failed to decrypt bot token for company: ${company.name}. Skipping.`);
        continue;
      }
      const token = decryptedToken;

      const decryptedSecret = decryptSecret(company.telegramWebhookSecret);
      if (!decryptedSecret) {
        console.error(`❌ Failed to decrypt webhook secret for company: ${company.name}. Skipping.`);
        continue;
      }
      let secret = decryptedSecret;

      // Ensure secret exists
      if (!secret) {
        secret = crypto.randomBytes(32).toString("hex");
        await prisma.company.update({
          where: { id: company.id },
          data: { telegramWebhookSecret: secret }
        });
        console.log(`🔑 Generated new telegramWebhookSecret for company: ${company.name}`);
      }

      try {
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
        console.error(`❌ Failed to register/sync bot @${company.telegramBotUsername || "bot"}:`, botErr.message);
      }
    }
  } catch (err: any) {
    console.error("❌ Failed to run initializeTelegramWebhooks:", err.message);
  }
}
