import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { createTenantRepository } from "../../lib/tenantDb";
import { asyncHandler, ApiError } from "../../middleware/error.middleware";
import { validateRequest } from "../../middleware/validate.middleware";
import { validateAndSanitizeCustomFields } from "../../utils/custom-fields.validator";
import { z } from "zod";

const router = Router();

// ==========================================
// DEALS VALIDATION SCHEMAS
// ==========================================

const createDealSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Deal name is required"),
    amount: z.number().optional().default(0),
    pipelineId: z.string().uuid("Invalid pipeline ID"),
    stageId: z.string().uuid("Invalid stage ID"),
    accountId: z.string().uuid("Invalid account ID").optional(),
    leadId: z.string().uuid("Invalid lead ID").optional(),
    ownerId: z.string().uuid("Invalid owner ID").optional(),
    status: z.enum(["OPEN", "WON", "LOST"]).optional().default("OPEN"),
    closingDate: z.string().datetime().optional(),
    tags: z.array(z.string()).optional(),
    customFields: z.any().optional(),
  }),
});

const updateDealSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Deal ID"),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    amount: z.number().optional(),
    pipelineId: z.string().uuid().optional(),
    stageId: z.string().uuid().optional(),
    accountId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    ownerId: z.string().uuid().optional(),
    status: z.enum(["OPEN", "WON", "LOST"]).optional(),
    closingDate: z.string().datetime().optional(),
    tags: z.array(z.string()).optional(),
    customFields: z.any().optional(),
  }),
});

// ==========================================
// DEALS
// ==========================================

router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenantDb = createTenantRepository(req.user!.companyId);
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string, 10) || 50));
    const skip = (page - 1) * limit;

    const [total, deals] = await Promise.all([
      tenantDb.deal.count(),
      tenantDb.deal.findMany({
        skip,
        take: limit,
        include: {
          stage: true,
          account: true,
          owner: { select: { id: true, firstName: true, lastName: true } },
          lead: true,
          tags: { include: { tag: true } },
        },
        orderBy: { createdAt: "desc" }
      })
    ]);

    res.json({
      data: deals,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + deals.length < total,
      }
    });
  })
);

router.post(
  "/",
  authMiddleware,
  validateRequest(createDealSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenantDb = createTenantRepository(req.user!.companyId);
    const { tags, customFields, ...data } = req.body;

    // Convert tags if present
    const tagConnects = tags
      ? {
          create: tags.map((t: string) => ({
            tag: { connect: { id: t } },
          })),
        }
      : undefined;

    let sanitizedCustomFields: any = null;
    if (customFields) {
      sanitizedCustomFields = await validateAndSanitizeCustomFields(req.user!.companyId, "DEAL", customFields);
    }

    const deal = await tenantDb.deal.create({
      data: {
        ...data,
        tags: tagConnects,
        customFields: sanitizedCustomFields
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        stage: true,
        account: true,
      },
    });
    res.status(201).json(deal);
  })
);

router.patch(
  "/:id",
  authMiddleware,
  validateRequest(updateDealSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenantDb = createTenantRepository(req.user!.companyId);
    const { tags, customFields, ...data } = req.body;
    
    // Check existing
    const existing = await tenantDb.deal.findFirst({
      where: { id: req.params.id }
    });
    if (!existing) {
      throw new ApiError(404, "Deal not found or unauthorized");
    }

    // Convert tags if present for updating
    const updateData: any = { ...data };
    
    if (tags) {
       updateData.tags = {
          deleteMany: {}, // Remove old tags
          create: tags.map((t: string) => ({
            tag: { connect: { id: t } },
          })),
       };
    }

    if (customFields !== undefined) {
      const sanitized = await validateAndSanitizeCustomFields(req.user!.companyId, "DEAL", customFields);
      const existingFields = (existing.customFields as Record<string, any>) || {};
      updateData.customFields = { ...existingFields, ...sanitized };
    }

    const deal = await tenantDb.deal.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        stage: true,
        account: true,
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.json(deal);
  })
);

export const dealRoutes = router;
