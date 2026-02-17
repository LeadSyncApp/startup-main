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

export const sendChatAction = async (
  botToken: string,
  chatId: string,
  action: "typing" | "upload_photo" | "record_video" | "record_audio" = "typing"
) => {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendChatAction`;
    await axios.post(url, {
      chat_id: chatId,
      action,
    });
  } catch (error) {
    // Ignore chat action errors (not critical)
  }
};
