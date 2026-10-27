import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../../config/prisma.config.js";
import { collateralService } from "../../services/collateral.service.js";
import { successResponse } from "../../utils/responseHandler.utils.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { paginate } from "../../utils/pagination.utils.js";

/**
 * Get all collaterals with optional query filters (platterId, projectId, status, code) and pagination
 */
export const getCollaterals = asyncHandler(async (req: Request, res: Response) => {
  const { platterId, projectId, status, code, page, limit, all } = req.query;

  const filter: any = {};
  if (platterId) filter.platterId = String(platterId);
  if (projectId) filter.projectId = String(projectId);
  if (status !== undefined) filter.status = status === "true";
  if (code) filter.code = String(code);

  const pageNum = page ? Number(page) : (all === "true" ? undefined : 1);
  const limitNum = limit ? Number(limit) : (all === "true" ? undefined : 10);

  if (pageNum !== undefined) {
    const result = await paginate(
      prisma.projectCollateral,
      {
        where: filter,
        orderBy: { seq: "asc" as const },
        include: { platter: true, project: true },
      },
      { page: pageNum, limit: limitNum || 10 }
    );
    successResponse(res, 200, "Collaterals fetched successfully", result);
    return;
  }

  const collaterals = await collateralService.getAllCollaterals(filter);
  successResponse(res, 200, "Collaterals fetched successfully", collaterals);
});

/**
 * Get active collaterals for a specific platter
 */
export const getActivePlatterCollaterals = asyncHandler(async (req: Request, res: Response) => {
  const platterId = String(req.params.platterId);
  const collaterals = await collateralService.getActiveCollateralsForPlatter(platterId);
  successResponse(res, 200, "Active platter collaterals fetched successfully", collaterals);
});

/**
 * Initialize platter-specific collaterals for a platter
 */
export const initPlatterCollaterals = asyncHandler(async (req: Request, res: Response) => {
  const platterId = String(req.params.platterId);
  await collateralService.ensurePlatterCollaterals(platterId);
  const result = await collateralService.getAllCollaterals({ platterId });
  successResponse(res, 201, "Platter collaterals initialized successfully", result);
});

/**
 * Configure which collaterals are active for a specific platter.
 * Accepts e.g. { activeCodes: ["STORY", "EDM", "BROCHURE"] }
 */
export const configurePlatterCollaterals = asyncHandler(async (req: Request, res: Response) => {
  const platterId = String(req.params.platterId);
  const { activeCodes } = req.body;

  if (!Array.isArray(activeCodes)) {
    throw new ApiError(400, "activeCodes must be an array of collateral codes (e.g. ['STORY', 'EDM'])");
  }

  const result = await collateralService.configurePlatterCollaterals(platterId, activeCodes);
  successResponse(res, 200, `Platter collaterals configured successfully: [${activeCodes.join(", ")}] active`, result);
});

/**
 * Get active collaterals for a specific project
 */
export const getActiveProjectCollaterals = asyncHandler(async (req: Request, res: Response) => {
  const projectId = String(req.params.projectId);
  const collaterals = await collateralService.getActiveCollateralsForProject(projectId);
  successResponse(res, 200, "Active project collaterals fetched successfully", collaterals);
});

/**
 * Get single collateral by ID
 */
export const getCollateralById = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const collateral = await collateralService.getCollateralById(id);

  if (!collateral) {
    throw new ApiError(404, "Collateral not found");
  }

  successResponse(res, 200, "Collateral fetched successfully", collateral);
});

/**
 * Create a new collateral
 */
export const createCollateral = asyncHandler(async (req: Request, res: Response) => {
  const { platterId, projectId, code, title, subtitle, icon, fileType, fileUrl, content, seq, status } = req.body;

  if (!title) {
    throw new ApiError(400, "Collateral title is required");
  }

  const collateral = await collateralService.createCollateral({
    platterId,
    projectId,
    code,
    title,
    subtitle,
    icon,
    fileType,
    fileUrl,
    content,
    seq: seq !== undefined ? Number(seq) : 0,
    status: status !== undefined ? Boolean(status) : true,
  });

  successResponse(res, 201, "Collateral created successfully", collateral);
});

/**
 * Update collateral
 */
export const updateCollateral = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { platterId, projectId, code, title, subtitle, icon, fileType, fileUrl, content, seq, status } = req.body;

  const updated = await collateralService.updateCollateral(id, {
    platterId,
    projectId,
    code,
    title,
    subtitle,
    icon,
    fileType,
    fileUrl,
    content,
    seq: seq !== undefined ? Number(seq) : undefined,
    status: status !== undefined ? Boolean(status) : undefined,
  });

  successResponse(res, 200, "Collateral updated successfully", updated);
});

/**
 * Toggle active / inactive status
 */
export const toggleCollateralStatus = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { status } = req.body;

  const updated = await collateralService.toggleStatus(
    id,
    status !== undefined ? Boolean(status) : undefined
  );

  successResponse(
    res,
    200,
    `Collateral status updated to ${updated.status ? "ACTIVE" : "INACTIVE"} successfully`,
    updated
  );
});

/**
 * Configure which collaterals are active for a specific project.
 * Accepts e.g. { activeCodes: ["FLOOR_PLAN", "GALLERY"] }
 */
export const configureProjectCollaterals = asyncHandler(async (req: Request, res: Response) => {
  const projectId = String(req.params.projectId);
  const { activeCodes } = req.body;

  if (!Array.isArray(activeCodes)) {
    throw new ApiError(400, "activeCodes must be an array of collateral codes (e.g. ['FLOOR_PLAN', 'GALLERY'])");
  }

  const result = await collateralService.configureProjectCollaterals(projectId, activeCodes);
  successResponse(res, 200, `Project collaterals configured successfully: [${activeCodes.join(", ")}] active`, result);
});

/**
 * Initialize project-specific collaterals for a project
 */
export const initProjectCollaterals = asyncHandler(async (req: Request, res: Response) => {
  const projectId = String(req.params.projectId);
  await collateralService.ensureProjectCollaterals(projectId);
  const result = await collateralService.getAllCollaterals({ projectId });
  successResponse(res, 201, "Project collaterals initialized successfully", result);
});

/**
 * Delete a collateral
 */
export const deleteCollateral = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  await collateralService.deleteCollateral(id);
  successResponse(res, 200, "Collateral deleted successfully");
});
