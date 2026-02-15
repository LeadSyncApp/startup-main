import axios from "axios"
import fs from "fs"
import path from "path"

export async function downloadTelegramVoice(
  botToken: string,
  fileId: string
): Promise<string> {
  // 1️⃣ Get file path from Telegram
  const fileInfo = await axios.get(
    `https://api.telegram.org/bot${botToken}/getFile`,
    { params: { file_id: fileId } }
  )

  const telegramPath = fileInfo.data.result.file_path
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${telegramPath}`

  // 2️⃣ Local storage
  const voicesDir = path.join(process.cwd(), "voices")
  if (!fs.existsSync(voicesDir)) fs.mkdirSync(voicesDir)

  const localPath = path.join(voicesDir, `${Date.now()}.ogg`)

  // 3️⃣ Download
  const response = await axios.get(fileUrl, { responseType: "stream" })
  const writer = fs.createWriteStream(localPath)

  response.data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(localPath))
    writer.on("error", reject)
  })
}
