import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { formatUploadedFile } from "../../middlewares/upload.middleware.js";
import { successResponse } from "../../utils/responseHandler.utils.js";
import { ApiError } from "../../utils/apiError.utils.js";

/**
 * Handle single file upload (image, pdf, document, video) into root uploads/
 */
export const uploadSingleFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, "No file uploaded. Please upload a file in 'file' field.");
  }

  const fileData = formatUploadedFile(req.file);
  successResponse(res, 201, "File uploaded successfully to root uploads directory", fileData);
});

/**
 * Handle multiple files upload into root uploads/
 */
export const uploadMultipleFiles = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    throw new ApiError(400, "No files uploaded. Please upload files in 'files' field.");
  }

  const filesData = files.map(formatUploadedFile);
  successResponse(res, 201, "Files uploaded successfully to root uploads directory", {
    count: filesData.length,
    files: filesData,
  });
});
