import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import * as projectService from "./project.service.js";
import { successResponse } from "../../utils/responseHandler.utils.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { formatUploadedFile } from "../../middlewares/upload.middleware.js";
import { getFileUrl } from "../../utils/fileHandling.utils.js";

export const getList = asyncHandler(async (req: Request, res: Response) => {
  const platterId = req.query.platterId as string | undefined;
  const page = req.query.page ? Number(req.query.page) : (req.query.all === "true" ? undefined : 1);
  const limit = req.query.limit ? Number(req.query.limit) : (req.query.all === "true" ? undefined : 10);

  const records = await projectService.getList(platterId, page !== undefined ? { page, limit } : undefined);
  if (records && "data" in records && Array.isArray((records as any).data)) {
    const transformed = await Promise.all(
      (records as any).data.map(async (p: any) => ({
        ...p,
        brochure: p.brochure ? (await getFileUrl(p.brochure)) || p.brochure : p.brochure,
      }))
    );
    successResponse(res, 200, "Projects fetched successfully", { ...records, data: transformed });
    return;
  }
  if (Array.isArray(records)) {
    const transformed = await Promise.all(
      records.map(async (p: any) => ({
        ...p,
        brochure: p.brochure ? (await getFileUrl(p.brochure)) || p.brochure : p.brochure,
      }))
    );
    successResponse(res, 200, "Projects fetched successfully", transformed);
    return;
  }
  successResponse(res, 200, "Projects fetched successfully", records);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const idOrSlug = String(req.params.id);
  const record = await projectService.getById(idOrSlug);
  if (!record) {
    throw new ApiError(404, "Project not found");
  }
  const transformed = {
    ...record,
    brochure: record.brochure ? (await getFileUrl(record.brochure)) || record.brochure : record.brochure,
  };
  successResponse(res, 200, "Project fetched successfully", transformed);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const record = await projectService.create(req.body);
  successResponse(res, 201, "Project created successfully!", record);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await projectService.update(id, req.body);
  successResponse(res, 200, "Project updated successfully!", record);
});

export const destroy = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await projectService.destroy(id);
  successResponse(res, 200, "Project deleted successfully!", record);
});

export const setDocuments = asyncHandler(async (req: Request, res: Response) => {
  const projectId = String(req.params.id);
  const data = { ...req.body };
  if (req.file) {
    const uploaded = formatUploadedFile(req.file);
    data.brochure = uploaded.path;
    data.hasDocuments = true;
  }
  const record = await projectService.setDocuments(projectId, data);
  successResponse(res, 200, "Project documents updated successfully!", record);
});
