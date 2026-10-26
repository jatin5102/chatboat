import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger.utils.js";
import { Prisma } from "../generated/prisma/client.js";
import { ApiError } from "../utils/apiError.utils.js";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode = 500;
  let message = "Internal Server Error";

  /**
   * Prisma Errors
   */
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002":
        statusCode = 409;
        message = `Duplicate value for ${err.meta?.target}`;
        break;

      case "P2025":
        statusCode = 404;
        message = "Record not found";
        break;

      case "P2003":
        statusCode = 400;
        message = "Invalid foreign key reference";
        break;

      default:
        statusCode = 400;
        message = err.message;
    }
  }

  /**
   * Custom ApiError
   */
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  /**
   * Zod Error (extra safety)
   */
  if (err?.name === "ZodError") {
    statusCode = 400;
    message = err.errors?.[0]?.message || "Validation failed";
  }

  logger.error("❌ ERROR:", {
    message: err.message,
    path: req.originalUrl,
    method: req.method,
  });

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
    }),
  });
};
