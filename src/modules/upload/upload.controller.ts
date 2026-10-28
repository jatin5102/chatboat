import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { formatUploadedFile } from "../../middlewares/upload.middleware.js";
import { successResponse } from "../../utils/responseHandler.utils.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { prisma } from "../../config/prisma.config.js";
import { FileType } from "../../generated/prisma/enums.js";

/**
 * Handle single file upload into directory AND save metadata into database
 */
export const uploadSingleFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, "No file uploaded. Please upload a file in 'file' field.");
  }

  const fileData = formatUploadedFile(req.file);
  const collateralId = (req.body?.collateralId || req.query?.collateralId) as string | undefined;
  const title = (req.body?.title || req.query?.title) as string | undefined;
  const seq = req.body?.seq !== undefined ? Number(req.body.seq) : 0;

  let fileType: FileType = FileType.document;
  if (fileData.fileType === "image") fileType = FileType.image;
  else if (fileData.fileType === "video") fileType = FileType.video;

  // Insert into database
  const mediaRecord = await prisma.collateralMedia.create({
    data: {
      collateralId: collateralId || null,
      title: title || fileData.originalname,
      originalName: fileData.originalname,
      fileName: fileData.filename,
      fileUrl: fileData.path,
      fileType,
      mimeType: fileData.mimetype,
      fileSize: fileData.size,
      seq,
      status: true,
    },
  });

  successResponse(res, 201, "File uploaded and stored in database successfully", {
    ...fileData,
    mediaRecord,
  });
});

/**
 * Handle multiple files upload into directory AND save each record into database
 */
export const uploadMultipleFiles = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    throw new ApiError(400, "No files uploaded. Please upload files in 'files' field.");
  }

  const collateralId = (req.body?.collateralId || req.query?.collateralId) as string | undefined;
  const baseTitle = (req.body?.title || req.query?.title) as string | undefined;
  const startSeq = req.body?.seq !== undefined ? Number(req.body.seq) : 0;

  const filesData = files.map(formatUploadedFile);

  const mediaRecords = await Promise.all(
    filesData.map(async (fileData, idx) => {
      let fileType: FileType = FileType.document;
      if (fileData.fileType === "image") fileType = FileType.image;
      else if (fileData.fileType === "video") fileType = FileType.video;

      const title = baseTitle
        ? `${baseTitle} (${idx + 1})`
        : fileData.originalname;

      return prisma.collateralMedia.create({
        data: {
          collateralId: collateralId || null,
          title,
          originalName: fileData.originalname,
          fileName: fileData.filename,
          fileUrl: fileData.path,
          fileType,
          mimeType: fileData.mimetype,
          fileSize: fileData.size,
          seq: startSeq + idx,
          status: true,
        },
      });
    })
  );

  successResponse(res, 201, "Files uploaded and stored in database successfully", {
    count: filesData.length,
    files: filesData,
    mediaRecords,
  });
});
