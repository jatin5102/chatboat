import { RequestHandler } from "express";
import logger from "../utils/logger.utils.js";
import { ZodError, ZodSchema } from "zod";

export const validate =
  (schema: ZodSchema): RequestHandler =>
  async (req, res, next) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        file: req.file,
        files: req.files,
      });

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));

        return res.status(400).json({
          status: "fail",
          type: "Validation Error!",
          errors,
        });
      }

      logger.error(error);
      return res.status(500).json({
        status: "error",
        message: "Something went wrong during validation",
      });
    }
  };
