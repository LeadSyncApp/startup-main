"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendChatAction = exports.sendTelegramMessage = void 0;
const axios_1 = __importDefault(require("axios"));
const sendTelegramMessage = async (botToken, chatId, text, replyMarkup) => {
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const payload = {
            chat_id: chatId,
            text,
            parse_mode: "HTML",
        };
        if (replyMarkup) {
            payload.reply_markup = replyMarkup;
        }
        await axios_1.default.post(url, payload);
    }
    catch (error) {
        console.error("❌ Telegram sendMessage error:", error.response?.data || error);
    }
};
exports.sendTelegramMessage = sendTelegramMessage;
const sendChatAction = async (botToken, chatId, action = "typing") => {
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendChatAction`;
        await axios_1.default.post(url, {
            chat_id: chatId,
            action,
        });
    }
    catch (error) {
        // Ignore chat action errors (not critical)
    }
};
exports.sendChatAction = sendChatAction;
