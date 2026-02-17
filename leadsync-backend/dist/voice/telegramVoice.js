"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadTelegramVoice = downloadTelegramVoice;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function downloadTelegramVoice(botToken, fileId) {
    // 1️⃣ Get file path from Telegram
    const fileInfo = await axios_1.default.get(`https://api.telegram.org/bot${botToken}/getFile`, { params: { file_id: fileId } });
    const telegramPath = fileInfo.data.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${telegramPath}`;
    // 2️⃣ Local storage
    const voicesDir = path_1.default.join(process.cwd(), "voices");
    if (!fs_1.default.existsSync(voicesDir))
        fs_1.default.mkdirSync(voicesDir);
    const localPath = path_1.default.join(voicesDir, `${Date.now()}.ogg`);
    // 3️⃣ Download
    const response = await axios_1.default.get(fileUrl, { responseType: "stream" });
    const writer = fs_1.default.createWriteStream(localPath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on("finish", () => resolve(localPath));
        writer.on("error", reject);
    });
}
