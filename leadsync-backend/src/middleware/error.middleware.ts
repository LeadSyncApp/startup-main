import { Request, Response, NextFunction } from "express";

export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let { statusCode, message } = err;

  if (!err.isOperational) {
    statusCode = 500;
    message = "Internal Server Error";
    console.error("🔥[Fatal Error]:", err);
  } else {
    // Log operational errors in lower level
    console.warn(`⚠️[ApiError]: ${message}`);
  }

  res.status(statusCode || 500).json({
    message: message,
    // Add additional fields if it's a validation error
    ...(err.errors && { errors: err.errors })
  });
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
