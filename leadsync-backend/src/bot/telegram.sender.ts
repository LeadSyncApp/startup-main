import axios from "axios";

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  replyMarkup?: any
) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const payload: any = {
      chat_id: chatId,
      text,
    };

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    await axios.post(url, payload);

    console.log("✅ Telegram sendMessage OK");
  } catch (error: any) {
    console.error(
      "❌ Telegram sendMessage error:",
      error.response?.data || error
    );
  }
}
