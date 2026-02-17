"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeWithWhisper = transcribeWithWhisper;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function transcribeWithWhisper(wavPath) {
    return new Promise((resolve, reject) => {
        const outputDir = path_1.default.dirname(wavPath);
        const baseName = path_1.default.basename(wavPath, ".wav");
        const txtPath = path_1.default.join(outputDir, `${baseName}.txt`);
        const cmd = `
      py -3.10 -m whisper "${wavPath}"
      --model small
      --language en
      --output_format txt
      --output_dir "${outputDir}"
      --fp16 True
    `.replace(/\s+/g, " ").trim();
        (0, child_process_1.exec)(cmd, (error) => {
            if (error) {
                console.error("❌ Whisper execution failed:", error);
                reject(error);
                return;
            }
            if (!fs_1.default.existsSync(txtPath)) {
                reject(new Error(`Whisper output file not found at ${txtPath}`));
                return;
            }
            const text = fs_1.default.readFileSync(txtPath, "utf-8").trim();
            resolve(text);
        });
    });
}
