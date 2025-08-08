import type { Request, Response, NextFunction } from "express";
import { AppError, logger } from "../utils";

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error("Error caught by error handler:", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  // Handle known application errors
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle Prisma errors
  if (error.name === "PrismaClientKnownRequestError") {
    const prismaError = error as any;

    switch (prismaError.code) {
      case "P2002":
        return res.status(409).json({
          success: false,
          message: "Duplicate entry found",
          timestamp: new Date().toISOString(),
        });
      case "P2025":
        return res.status(404).json({
          success: false,
          message: "Record not found",
          timestamp: new Date().toISOString(),
        });
      default:
        return res.status(400).json({
          success: false,
          message: "Database error occurred",
          timestamp: new Date().toISOString(),
        });
    }
  }

  // Handle validation errors
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: (error as any).errors,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle JWT errors
  if (error.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
      timestamp: new Date().toISOString(),
    });
  }

  if (error.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
      timestamp: new Date().toISOString(),
    });
  }

  // Handle multer errors
  if (error.name === "MulterError") {
    const multerError = error as any;
    switch (multerError.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          message: "File too large",
          timestamp: new Date().toISOString(),
        });
      case "LIMIT_FILE_COUNT":
        return res.status(400).json({
          success: false,
          message: "Too many files",
          timestamp: new Date().toISOString(),
        });
      default:
        return res.status(400).json({
          success: false,
          message: "File upload error",
          timestamp: new Date().toISOString(),
        });
    }
  }

  // Default error response
  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message,
    timestamp: new Date().toISOString(),
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
