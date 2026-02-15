import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: "OWNER" | "ADMIN" | "AGENT";
  };
}

interface JwtPayload {
  userId: string;
  companyId: string;
  role: "OWNER" | "ADMIN" | "AGENT";
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    if (!decoded.userId || !decoded.companyId) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = {
      userId: decoded.userId,
      companyId: decoded.companyId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
