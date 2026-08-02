import { Request, Response, NextFunction } from "express";

export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code: string;

  constructor(statusCode: number, message: string, isOperational = true, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code || this.inferCode(statusCode);
    Error.captureStackTrace(this, this.constructor);
  }

  private inferCode(status: number): string {
    const map: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "VALIDATION_ERROR",
      429: "RATE_LIMITED",
      500: "INTERNAL_ERROR",
    };
    return map[status] || "ERROR";
  }
}

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let { statusCode, message } = err;
  const code = err.code || "INTERNAL_ERROR";

  if (!err.isOperational) {
    statusCode = 500;
    message = "Internal Server Error";
    console.error("🔥[Fatal Error]:", err);
  } else {
    console.warn(`⚠️[ApiError]: ${message}`);
  }

  res.status(statusCode || 500).json({
    error: code,
    message: message,
    statusCode: statusCode || 500,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== "production" && err.stack && { stack: err.stack }),
    ...(err.errors && { details: err.errors }),
  });
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
