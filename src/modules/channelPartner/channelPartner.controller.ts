import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import * as cpService from "./channelPartner.service.js";
import { successResponse } from "../../utils/responseHandler.utils.js";
import { ApiError } from "../../utils/apiError.utils.js";

export const getList = asyncHandler(async (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;
  const page = req.query.page ? Number(req.query.page) : (req.query.all === "true" ? undefined : 1);
  const limit = req.query.limit ? Number(req.query.limit) : (req.query.all === "true" ? undefined : 10);

  const records = await cpService.getList(search, page !== undefined ? { page, limit } : undefined);
  successResponse(res, 200, "Channel partners fetched successfully", records);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const idOrRera = String(req.params.id);
  const record = await cpService.getById(idOrRera);
  if (!record) {
    throw new ApiError(404, "Channel partner not found");
  }
  successResponse(res, 200, "Channel partner fetched successfully", record);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const record = await cpService.create(req.body);
  successResponse(res, 201, "Channel partner created successfully!", record);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await cpService.update(id, req.body);
  successResponse(res, 200, "Channel partner updated successfully!", record);
});

export const destroy = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const record = await cpService.destroy(id);
  successResponse(res, 200, "Channel partner deleted successfully!", record);
});
