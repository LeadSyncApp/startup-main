import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload as DefaultJwtPayload } from "jsonwebtoken";
import { prisma, getTenantPrismaContext } from "../lib/prisma";
import { tenantContextStorage, resolveTenantContext } from "../services/context/tenantContext.provider";

import { can, Permission } from "../services/auth/permissions.service";

// Augment Express's built-in User type
declare global {
  namespace Express {
    interface User {
      userId: string;
      companyId: string;
      role: "OWNER" | "MANAGER" | "STAFF";
      staffId?: string;
      name?: string;
      authProvider?: string;
      permissionOverrides?: any;
    }
  }
}

export interface AuthRequest extends Request {
  tenantDb?: ReturnType<typeof getTenantPrismaContext>;
}

interface JwtPayload extends DefaultJwtPayload {
  userId: string;
  companyId: string;
  role: "OWNER" | "MANAGER" | "STAFF";
  staffId?: string;
  name?: string;
  authProvider?: string;
  permissionOverrides?: any;
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not defined in environment variables.");
  process.exit(1);
}

const agentStatusCache = new Map<string, { isActive: boolean; permissionOverrides: any; lastChecked: number }>();
const CACHE_LIFECYCLE_MS = 30000;

export const invalidateUserCache = (userId: string) => {
  agentStatusCache.delete(userId);
};

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = parts[1];

    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    }) as JwtPayload;

    if (!decoded.userId || !decoded.companyId || !decoded.role) {
      return res.status(401).json({ message: "Invalid token" });
    }

    if (!["OWNER", "MANAGER", "STAFF"].includes(decoded.role)) {
      return res.status(401).json({ message: "Invalid role" });
    }

    const now = Date.now();
    const cachedSession = agentStatusCache.get(decoded.userId);
    let isActive = false;
    let permissionOverrides: any = decoded.permissionOverrides ?? null;

    if (cachedSession && (now - cachedSession.lastChecked < CACHE_LIFECYCLE_MS)) {
      isActive = cachedSession.isActive;
      permissionOverrides = cachedSession.permissionOverrides;
    } else {
      const userExists = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, isActive: true, permissionOverrides: true },
      });

      if (!userExists) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      isActive = userExists.isActive;
      permissionOverrides = userExists.permissionOverrides;
      agentStatusCache.set(decoded.userId, { isActive, permissionOverrides, lastChecked: now });
    }

    if (!isActive) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = {
      userId: decoded.userId,
      companyId: decoded.companyId,
      role: decoded.role,
      staffId: decoded.staffId,
      name: decoded.name,
      authProvider: decoded.authProvider,
      permissionOverrides: permissionOverrides,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.warn(`🛑 RBAC Violation: User ${req.user.userId} with role ${req.user.role} tried to access a restricted route.`);
      return res.status(403).json({
        message: "Access Denied: You do not have permission to perform this action."
      });
    }

    next();
  };
};

export const authorizePermission = (permission: Permission) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!can(req.user, permission)) {
      console.warn(`🛑 Permission Violation: User ${req.user.userId} with role ${req.user.role} tried to access ${permission}.`);
      return res.status(403).json({
        message: "Access Denied: You do not have permission to perform this action."
      });
    }

    next();
  };
};

export const injectTenantContext = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || !req.user.companyId) {
    return res.status(401).json({ message: "Unauthorized: Missing user context" });
  }

  const { companyId } = req.user;

  try {
    const context = await resolveTenantContext(companyId);
    tenantContextStorage.run(context, () => {
      req.tenantDb = getTenantPrismaContext(companyId);
      next();
    });
  } catch (error: any) {
    console.error("Tenant isolation middleware error:", error);
    return res.status(500).json({ message: "Internal server error during tenant isolation setup" });
  }
};
