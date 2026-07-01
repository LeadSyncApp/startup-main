import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { createTenantRepository } from "../../lib/tenantDb";
import { asyncHandler } from "../../middleware/error.middleware";
import { validateRequest } from "../../middleware/validate.middleware";
import { z } from "zod";

const router = Router();

// ==========================================
// VALIDATION SCHEMAS
// ==========================================
const createPipelineSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Pipeline name is required"),
    stages: z.array(z.object({
      name: z.string().min(1, "Stage name is required"),
      probability: z.number().min(0).max(100).optional().default(0)
    })).optional().default([])
  })
});

// ==========================================
// PIPELINES & STAGES
// ==========================================

router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenantDb = createTenantRepository(req.user!.companyId);
    const pipelines = await tenantDb.pipeline.findMany({
      include: { stages: { orderBy: { order: "asc" } } },
    });
    res.json(pipelines);
  })
);

router.post(
  "/",
  authMiddleware,
  validateRequest(createPipelineSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenantDb = createTenantRepository(req.user!.companyId);
    const { name, stages } = req.body;
    
    const pipeline = await tenantDb.pipeline.create({
      data: {
        name,
        stages: {
          create: stages.map((s: any, idx: number) => ({
            name: s.name,
            probability: s.probability,
            order: idx,
            companyId: req.user!.companyId,
          })),
        },
      },
      include: { stages: true },
    });
    
    res.status(201).json(pipeline);
  })
);

export const pipelineRoutes = router;
