import axios from "axios";

export const sendTelegramMessage = async (
  botToken: string,
  chatId: string,
  text: string,
  replyMarkup?: any
) => {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    };

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    await axios.post(url, payload);
  } catch (error: any) {
    console.error(
      "❌ Telegram sendMessage error:",
      error.response?.data || error
    );
  }
};
