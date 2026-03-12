import { exec } from "child_process"
import fs from "fs"
import path from "path"

export function transcribeWithWhisper(wavPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputDir = path.dirname(wavPath)
    const baseName = path.basename(wavPath, ".wav")
    const txtPath = path.join(outputDir, `${baseName}.txt`)

    const cmd = `
      py -3.10 -m whisper "${wavPath}"
      --model small
      --language en
      --output_format txt
      --output_dir "${outputDir}"
      --fp16 True
    `.replace(/\s+/g, " ").trim()

    exec(cmd, (error) => {
      if (error) {
        console.error("❌ Whisper execution failed:", error)
        reject(error)
        return
      }

      if (!fs.existsSync(txtPath)) {
        reject(
          new Error(`Whisper output file not found at ${txtPath}`)
        )
        return
      }

      const text = fs.readFileSync(txtPath, "utf-8").trim()
      resolve(text)
    })
  })
}
