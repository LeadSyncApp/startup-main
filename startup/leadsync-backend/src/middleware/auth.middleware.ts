import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload as DefaultJwtPayload } from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: "OWNER" | "ADMIN" | "AGENT";
    staffId?: string;
  };
}

interface JwtPayload extends DefaultJwtPayload {
  userId: string;
  companyId: string;
  role: "OWNER" | "ADMIN" | "AGENT";
  staffId?: string;
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not defined in environment variables.");
  process.exit(1);
}

export const authMiddleware = (
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

    if (!["OWNER", "ADMIN", "AGENT"].includes(decoded.role)) {
      return res.status(401).json({ message: "Invalid role" });
    }

    req.user = {
      userId: decoded.userId,
      companyId: decoded.companyId,
      role: decoded.role,
      staffId: decoded.staffId,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

/**
 * RBAC Middleware: Restrict access based on user role.
 * Usage: authorizeRoles("OWNER", "ADMIN")
 */
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
