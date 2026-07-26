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
const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    type: z.enum(["TODO", "CALL", "EMAIL", "MEETING"]).optional().default("TODO"),
    status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).optional().default("PENDING"),
    dueDate: z.string().datetime().nullable().optional(),
    leadId: z.string().uuid().optional(),
    dealId: z.string().uuid().optional(),
    ownerId: z.string().uuid().optional()
  })
});

const updateTaskSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Task ID")
  }),
  body: z.object({
    title: z.string().min(1).optional(),
    type: z.enum(["TODO", "CALL", "EMAIL", "MEETING"]).optional(),
    status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).optional(),
    dueDate: z.string().datetime().nullable().optional(),
    leadId: z.string().uuid().optional().nullable(),
    dealId: z.string().uuid().optional().nullable(),
    ownerId: z.string().uuid().optional().nullable()
  })
});

// ==========================================
// TASKS
// ==========================================

router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenantDb = createTenantRepository(req.user!.companyId);
    const filters: any = {};
    if (req.query.ownerId) filters.ownerId = req.query.ownerId;
    if (req.query.dealId) filters.dealId = req.query.dealId;
    if (req.query.leadId) filters.leadId = req.query.leadId;

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string, 10) || 50));
    const skip = (page - 1) * limit;

    const [total, tasks] = await Promise.all([
      tenantDb.task.count({ where: filters }),
      tenantDb.task.findMany({
        where: filters,
        skip,
        take: limit,
        include: { owner: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { dueDate: "asc" },
      })
    ]);

    res.json({
      data: tasks,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + tasks.length < total,
      }
    });
  })
);

router.post(
  "/",
  authMiddleware,
  validateRequest(createTaskSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenantDb = createTenantRepository(req.user!.companyId);
    const task = await tenantDb.task.create({
      data: {
        ...req.body,
        ownerId: req.body.ownerId || req.user!.userId,
      },
      include: { owner: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.status(201).json(task);
  })
);

router.patch(
  "/:id",
  authMiddleware,
  validateRequest(updateTaskSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenantDb = createTenantRepository(req.user!.companyId);
    
    const task = await tenantDb.task.update({
        where: { id: req.params.id },
        data: req.body,
    });
    
    res.json(task);
  })
);

export const taskRoutes = router;
