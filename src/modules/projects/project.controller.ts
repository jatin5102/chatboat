import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import * as projectService from "./project.service.js";
import { successResponse } from "../../utils/responseHandler.utils.js";
import { ApiError } from "../../utils/apiError.utils.js";

export const getList = asyncHandler(async (req: Request, res: Response) => {
  const platterId = req.query.platterId as string | undefined;
  const records = await projectService.getList(platterId);
  successResponse(res, 200, "Projects fetched successfully", records);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const idOrSlug = String(req.params.id);
  const record = await projectService.getById(idOrSlug);
  if (!record) {
    throw new ApiError(404, "Project not found");
  }
  successResponse(res, 200, "Project fetched successfully", record);
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

export const getGallery = asyncHandler(async (req: Request, res: Response) => {
  const projectId = String(req.params.projectId);
  const records = await projectService.getGallery(projectId);
  successResponse(res, 200, "Project gallery fetched successfully", records);
});

export const addGalleryItem = asyncHandler(async (req: Request, res: Response) => {
  const projectId = String(req.params.projectId);
  const record = await projectService.addGalleryItem(projectId, req.body);
  successResponse(res, 201, "Gallery item added successfully!", record);
});

export const updateGalleryItem = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await projectService.updateGalleryItem(id, req.body);
  successResponse(res, 200, "Gallery item updated successfully!", record);
});

export const deleteGalleryItem = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await projectService.deleteGalleryItem(id);
  successResponse(res, 200, "Gallery item deleted successfully!", record);
});

export const setDocuments = asyncHandler(async (req: Request, res: Response) => {
  const projectId = String(req.params.id);
  const record = await projectService.setDocuments(projectId, req.body);
  successResponse(res, 200, "Project documents updated successfully!", record);
});
