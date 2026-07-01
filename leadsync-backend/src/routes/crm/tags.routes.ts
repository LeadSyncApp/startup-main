import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { createTenantRepository } from "../../lib/tenantDb";
import { asyncHandler, ApiError } from "../../middleware/error.middleware";
import { validateRequest } from "../../middleware/validate.middleware";
import { z } from "zod";

const router = Router();

// ==========================================
// VALIDATION SCHEMAS
// ==========================================
const createTagSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Tag name is required"),
    color: z.string().optional()
  })
});

// ==========================================
// TAGS
// ==========================================

router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenantDb = createTenantRepository(req.user!.companyId);
    const tags = await tenantDb.tag.findMany();
    res.json(tags);
  })
);

router.post(
  "/",
  authMiddleware,
  validateRequest(createTagSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const tenantDb = createTenantRepository(req.user!.companyId);
      const tag = await tenantDb.tag.create({
        data: {
          ...req.body,
        },
      });
      res.status(201).json(tag);
    } catch (error: any) {
      if (error.code === "P2002") {
        throw new ApiError(400, "Tag already exists");
      }
      throw error;
    }
  })
);

export const tagRoutes = router;
