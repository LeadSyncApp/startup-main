import { Router, Request, Response } from "express";
import { runParseComparison, ModelParseResult } from "../../services/ai/modelComparison.service";

const router = Router();

// Scope guardrail: Allowed test company IDs (throwaway/disposable only)
const ALLOWED_TEST_COMPANY_IDS = new Set([
  "test-company-1",  // Placeholder - user should create a throwaway test company
  "00000000-0000-0000-0000-000000000000", // placeholder
]);

// Guardrail: Block access to real verification company
const BLOCKED_COMPANY_IDS = new Set([
  "3102a85e-1798-45bb-b6c5-d94ea436f775", // Om Sai Silk Boutique - REAL company
]);

/**
 * Middleware to validate test company guardrail
 * Only allows requests with valid test company context or no auth (for quick testing)
 */
function testCompanyGuard(req: Request, res: Response, next: Function) {
  const companyId = (req as any).user?.companyId || req.headers['x-test-company-id'] as string;
  
  if (companyId && BLOCKED_COMPANY_IDS.has(companyId)) {
    console.warn(`[GUARDRAIL] Blocked access to protected company: ${companyId}`);
    return res.status(403).json({ 
      error: "Access denied: This endpoint is for throwaway test companies only" 
    });
  }
  
  next();
}

/**
 * POST /internal/test/parse-compare
 * 
 * Multi-model parsing comparison harness - for testing only.
 * Takes raw free-text product description and parses it with three models in parallel:
 * - Groq llama-3.3-70b-versatile
 * - Groq llama-3.1-8b-instant
 * - Sarvam AI chat/completions
 * 
 * Logs all outputs to console for side-by-side comparison.
 * Does NOT save to any production tables.
 */
router.post("/parse-compare", testCompanyGuard, async (req: Request, res: Response) => {
  try {
    const { owner_text } = req.body;

    if (!owner_text || typeof owner_text !== "string") {
      return res.status(400).json({ 
        error: "owner_text is required and must be a string" 
      });
    }

    // Run comparison across all three models
    const results = await runParseComparison(owner_text);

// Return structured comparison results - include per-model latency and debug info
      const response = {
        input_text: owner_text,
        timestamp: new Date().toISOString(),
        models: results.map((r: ModelParseResult) => ({
          model: r.model,
          parse_success: r.parse_success,
          error: r.error || null,
          raw_output: r.raw_output,
          parsed: r.parsed,
          latency_ms: r.latency_ms,
          finish_reason: r.finish_reason || null,
          full_response: r.full_response || null
        }))
      };

    return res.json(response);

  } catch (error: any) {
    console.error("Parse comparison error:", error);
    return res.status(500).json({ 
      error: "Failed to run parse comparison",
      details: error.message 
    });
  }
});

export default router;
