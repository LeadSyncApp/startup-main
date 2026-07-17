import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { sysLog } from "../../lib/logger";
import { asyncHandler, ApiError } from "../../middleware/error.middleware";
import { validateRequest } from "../../middleware/validate.middleware";
import { z } from "zod";

const router = Router();

const createFieldSchema = z.object({
  body: z.object({
    module: z.enum(["LEAD", "ACCOUNT", "DEAL"]),
    name: z.string().min(1, "Name is required").regex(/^[a-z0-9_]+$/, "Name must be alphanumeric with underscores and lowercase only"),
    label: z.string().min(1, "Label is required"),
    type: z.enum(["TEXT", "NUMBER", "BOOLEAN", "DATE", "DROPDOWN"]),
    required: z.boolean().optional().default(false),
    options: z.array(z.string()).optional(),
    defaultValue: z.string().optional()
  })
});

const updateFieldSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Field Definition ID")
  }),
  body: z.object({
    label: z.string().min(1).optional(),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
    defaultValue: z.string().optional()
  })
});

// GET custom fields configuration
router.get(
  "/fields",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { companyId } = req.user!;
    const { module } = req.query;

    const whereClause: any = { companyId };
    if (module && typeof module === "string") {
      whereClause.module = module.toUpperCase();
    }

    const customFieldModel = (prisma as any).customFieldDefinition;
    if (!customFieldModel) {
      sysLog.warn(`CustomFieldDefinition model missing in client for company: ${companyId}`);
      return res.json([]);
    }

    const definitions = await customFieldModel.findMany({
      where: whereClause,
      orderBy: { createdAt: "asc" }
    });

    res.json(definitions || []);
  })
);

// POST create custom field definition
router.post(
  "/fields",
  authMiddleware,
  validateRequest(createFieldSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { companyId } = req.user!;
    const { module, name, label, type, required, options, defaultValue } = req.body;

    // Check if dynamic field name is already taken of standard properties OR exists in CustomFieldDefinition
    const lowercaseName = name.toLowerCase();
    const reservedFields: Record<string, string[]> = {
      LEAD: ["id", "name", "contact", "preferredlanguage", "channel", "companyid", "createdat", "lastactiveat", "ordercount", "segment", "status", "totalspend", "customfields", "accountid"],
      ACCOUNT: ["id", "companyid", "name", "industry", "website", "customfields", "createdat", "updatedat"],
      DEAL: ["id", "companyid", "name", "amount", "currency", "pipelineid", "stageid", "leadid", "accountid", "ownerid", "expectedclosedate", "customfields", "status", "createdat", "updatedat"]
    };

    if (reservedFields[module as keyof typeof reservedFields]?.includes(lowercaseName)) {
      throw new ApiError(400, `The field name '${name}' is reserved by the built-in system.`);
    }

    // Check existing definitions
    const existing = await (prisma as any).customFieldDefinition.findFirst({
      where: {
        companyId,
        module,
        name: lowercaseName
      }
    });

    if (existing) {
      throw new ApiError(400, `A custom field with key '${name}' already exists for this module.`);
    }

    const definition = await (prisma as any).customFieldDefinition.create({
      data: {
        companyId,
        module: module.toUpperCase(),
        name: lowercaseName,
        label,
        type,
        required: required || false,
        options: options || null,
        defaultValue: defaultValue || null
      }
    });

    res.status(201).json(definition);
  })
);

// PUT update custom field definition labels/mandatory status
router.put(
  "/fields/:id",
  authMiddleware,
  validateRequest(updateFieldSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { companyId } = req.user!;
    const { id } = req.params;

    const existing = await (prisma as any).customFieldDefinition.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      throw new ApiError(404, "Custom field definition not found or unauthorized.");
    }

    const { label, required, options, defaultValue } = req.body;

    const updated = await (prisma as any).customFieldDefinition.update({
      where: { id, companyId },
      data: {
        ...(label && { label }),
        ...(required !== undefined && { required }),
        ...(options && { options }),
        ...(defaultValue !== undefined && { defaultValue })
      }
    });

    res.json(updated);
  })
);

// DELETE custom field definition
router.delete(
  "/fields/:id",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { companyId } = req.user!;
    const { id } = req.params;

    const existing = await (prisma as any).customFieldDefinition.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      throw new ApiError(404, "Custom field definition not found or unauthorized.");
    }

    await (prisma as any).customFieldDefinition.delete({
      where: { id, companyId }
    });

    res.json({ message: "Custom field definition deleted successfully." });
  })
);

export const metadataRoutes = router;
