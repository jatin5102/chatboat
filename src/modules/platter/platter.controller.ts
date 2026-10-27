import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import * as platterService from "./platter.service.js";
import { successResponse } from "../../utils/responseHandler.utils.js";
import { ApiError } from "../../utils/apiError.utils.js";

export const getList = asyncHandler(async (req: Request, res: Response) => {
  const onlyActive = req.query.all !== "true";
  const page = req.query.page ? Number(req.query.page) : (req.query.all === "true" ? undefined : 1);
  const limit = req.query.limit ? Number(req.query.limit) : (req.query.all === "true" ? undefined : 10);

  const records = await platterService.getList({ onlyActive, page, limit });
  successResponse(res, 200, "Platters fetched successfully", records);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const idOrSlug = String(req.params.id);
  const record = await platterService.getById(idOrSlug);
  if (!record) {
    throw new ApiError(404, "Platter not found");
  }
  successResponse(res, 200, "Platter fetched successfully", record);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const record = await platterService.create(req.body);
  successResponse(res, 201, "Platter created successfully!", record);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await platterService.update(id, req.body);
  successResponse(res, 200, "Platter updated successfully!", record);
});

export const destroy = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await platterService.destroy(id);
  successResponse(res, 200, "Platter deleted successfully!", record);
});
