import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { sysLog } from "../../lib/logger";
import { asyncHandler, ApiError } from "../../middleware/error.middleware";
import { validateRequest } from "../../middleware/validate.middleware";
import { z } from "zod";

const router = Router();

const createFieldSchema = z.object({
  params: z.object({
    companyId: z.string().uuid("Invalid Company ID"),
  }),
  body: z.object({
    fieldName: z.string().min(1, "Field name is required").regex(/^[a-zA-Z0-9_]+$/, "Field name must be alphanumeric with underscores"),
    fieldType: z.enum(["text", "number", "boolean", "select"]),
    appliesTo: z.enum(["product", "variant"]),
    options: z.array(z.string()).optional().default([]),
    sortOrder: z.number().int().optional().default(0),
  }),
});

const updateFieldSchema = z.object({
  params: z.object({
    companyId: z.string().uuid("Invalid Company ID"),
    id: z.string().uuid("Invalid Field Definition ID"),
  }),
  body: z.object({
    fieldName: z.string().min(1).regex(/^[a-zA-Z0-9_]+$/).optional(),
    fieldType: z.enum(["text", "number", "boolean", "select"]).optional(),
    appliesTo: z.enum(["product", "variant"]).optional(),
    options: z.array(z.string()).optional(),
    sortOrder: z.number().int().optional(),
  }),
});

// GET product field definitions for a company
router.get(
  "/companies/:companyId/product-fields",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { companyId } = req.params;

    if (req.user!.companyId !== companyId) {
      throw new ApiError(403, "Unauthorized access to company resources.");
    }

    const productFieldModel = (prisma as any).productFieldDefinition;
    if (!productFieldModel) {
      sysLog.warn(`ProductFieldDefinition model missing in client for company: ${companyId}`);
      return res.json([]);
    }

    const definitions = await productFieldModel.findMany({
      where: { companyId },
      orderBy: { sortOrder: "asc" },
    });

    res.json(definitions || []);
  })
);

// POST create product field definition
router.post(
  "/companies/:companyId/product-fields",
  authMiddleware,
  validateRequest(createFieldSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { companyId } = req.params;
    const { fieldName, fieldType, appliesTo, options, sortOrder } = req.body;

    if (req.user!.companyId !== companyId) {
      throw new ApiError(403, "Unauthorized access to company resources.");
    }

    const productFieldModel = (prisma as any).productFieldDefinition;
    if (!productFieldModel) {
      throw new ApiError(500, "ProductFieldDefinition model is not available.");
    }

    const existing = await productFieldModel.findFirst({
      where: { companyId, fieldName },
    });

    if (existing) {
      throw new ApiError(400, `A product field with name '${fieldName}' already exists for this company.`);
    }

    const definition = await productFieldModel.create({
      data: {
        companyId,
        fieldName,
        fieldType,
        appliesTo,
        options: fieldType === "select" ? (options || []) : [],
        sortOrder: sortOrder || 0,
      },
    });

    res.status(201).json(definition);
  })
);

// PUT update product field definition
router.put(
  "/companies/:companyId/product-fields/:id",
  authMiddleware,
  validateRequest(updateFieldSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { companyId, id } = req.params;

    if (req.user!.companyId !== companyId) {
      throw new ApiError(403, "Unauthorized access to company resources.");
    }

    const productFieldModel = (prisma as any).productFieldDefinition;
    if (!productFieldModel) {
      throw new ApiError(500, "ProductFieldDefinition model is not available.");
    }

    const existing = await productFieldModel.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new ApiError(404, "Product field definition not found or unauthorized.");
    }

    const { fieldName, fieldType, appliesTo, options, sortOrder } = req.body;

    const updated = await productFieldModel.update({
      where: { id },
      data: {
        ...(fieldName !== undefined && { fieldName }),
        ...(fieldType !== undefined && { fieldType }),
        ...(appliesTo !== undefined && { appliesTo }),
        ...(options !== undefined && { options }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    res.json(updated);
  })
);

// DELETE product field definition
router.delete(
  "/companies/:companyId/product-fields/:id",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { companyId, id } = req.params;

    if (req.user!.companyId !== companyId) {
      throw new ApiError(403, "Unauthorized access to company resources.");
    }

    const productFieldModel = (prisma as any).productFieldDefinition;
    if (!productFieldModel) {
      throw new ApiError(500, "ProductFieldDefinition model is not available.");
    }

    const existing = await productFieldModel.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new ApiError(404, "Product field definition not found or unauthorized.");
    }

    await productFieldModel.delete({
      where: { id },
    });

    res.json({ message: "Product field definition deleted successfully." });
  })
);

export const productFieldsRoutes = router;
