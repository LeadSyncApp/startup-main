import { Router } from "express";
import multer from "multer";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { processVoiceIntake } from "../../services/inventory/voiceIntake.service";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max audio file size
});

/**
 * POST /companies/:id/inventory/voice-intake
 * 
 * Takes recorded audio file (multipart/form-data key: 'audio')
 * Accepts optional 'language' field in multipart body (e.g. 'English', 'Tamil', 'Hindi')
 * 1. Transcribes audio via Sarvam saaras:v3 STT (with language_code hint and silence detection)
 * 2. Extracts product fields via Groq llama-3.1-8b-instant LLM
 * 3. Returns { transcript, extracted: { product_name, price, stock, fabric_type, category, description } }
 */
router.post(
  "/:id/inventory/voice-intake",
  authMiddleware,
  upload.single("audio"),
  async (req: AuthRequest, res) => {
    const { id: companyId } = req.params;
    const userCompanyId = req.user?.companyId;

    if (!userCompanyId) {
      return res.status(401).json({ error: "No company context" });
    }
    if (companyId !== userCompanyId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "Audio file is required (form key 'audio')" });
    }

    try {
      const filename = req.file.originalname || "recording.webm";
      const mimeType = req.file.mimetype || "audio/webm";
      const language = (req.body?.language || req.query?.language || "English") as string;

      const result = await processVoiceIntake(req.file.buffer, filename, mimeType, language);

      return res.json(result);
    } catch (error: any) {
      console.error("[VoiceIntakeRoute] Error processing voice intake:", error);
      return res.status(400).json({
        error: error.message || "Failed to process voice intake",
        details: error.message || String(error),
      });
    }
  }
);

export default router;
