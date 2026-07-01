import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { createTenantRepository } from "../../lib/tenantDb";
import { asyncHandler, ApiError } from "../../middleware/error.middleware";
import { validateRequest } from "../../middleware/validate.middleware";
import { validateAndSanitizeCustomFields } from "../../utils/custom-fields.validator";
import { z } from "zod";

const router = Router();

// ==========================================
// VALIDATION SCHEMAS
// ==========================================
const createAccountSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Account name is required"),
    industry: z.string().optional(),
    website: z.string().url().optional().or(z.literal("")),
    size: z.string().optional(),
    phone: z.string().optional(),
    customFields: z.any().optional()
  })
});

const updateAccountSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Account ID")
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    industry: z.string().optional(),
    website: z.string().url().optional().or(z.literal("")),
    size: z.string().optional(),
    phone: z.string().optional(),
    customFields: z.any().optional()
  })
});

// ==========================================
// ACCOUNTS
// ==========================================

router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenantDb = createTenantRepository(req.user!.companyId);
    const accounts = await tenantDb.account.findMany({
      include: { leads: true, deals: true },
    });
    res.json(accounts);
  })
);

router.post(
  "/",
  authMiddleware,
  validateRequest(createAccountSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenantDb = createTenantRepository(req.user!.companyId);
    const { customFields, ...bodyData } = req.body;
    let sanitizedCustomFields: any = null;
    
    if (customFields) {
      sanitizedCustomFields = await validateAndSanitizeCustomFields(req.user!.companyId, "ACCOUNT", customFields);
    }

    const account = await tenantDb.account.create({
      data: {
        ...bodyData,
        customFields: sanitizedCustomFields
      },
    });
    res.status(201).json(account);
  })
);

router.put(
  "/:id",
  authMiddleware,
  validateRequest(updateAccountSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenantDb = createTenantRepository(req.user!.companyId);
    const { customFields, ...bodyData } = req.body;
    
    // Check existing
    const existing = await tenantDb.account.findFirst({
      where: { id: req.params.id }
    });
    if (!existing) {
      throw new ApiError(404, "Account not found or unauthorized");
    }

    const updateData: any = { ...bodyData };
    if (customFields !== undefined) {
      const sanitized = await validateAndSanitizeCustomFields(req.user!.companyId, "ACCOUNT", customFields);
      const existingFields = (existing.customFields as Record<string, any>) || {};
      updateData.customFields = { ...existingFields, ...sanitized };
    }

    const account = await tenantDb.account.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json(account);
  })
);

export const accountRoutes = router;
