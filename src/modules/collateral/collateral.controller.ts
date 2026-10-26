import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { collateralService } from "../../services/collateral.service.js";
import { successResponse } from "../../utils/responseHandler.utils.js";
import { ApiError } from "../../utils/apiError.utils.js";

/**
 * Get all collaterals with optional query filters (projectId, status, code)
 */
export const getCollaterals = asyncHandler(async (req: Request, res: Response) => {
  const { projectId, status, code } = req.query;

  const filter: any = {};
  if (projectId) filter.projectId = String(projectId);
  if (status !== undefined) filter.status = status === "true";
  if (code) filter.code = String(code);

  const collaterals = await collateralService.getAllCollaterals(filter);
  successResponse(res, 200, "Collaterals fetched successfully", collaterals);
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
  const { projectId, code, title, subtitle, icon, fileType, fileUrl, content, seq, status } = req.body;

  if (!title) {
    throw new ApiError(400, "Collateral title is required");
  }

  const collateral = await collateralService.createCollateral({
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
  const { projectId, code, title, subtitle, icon, fileType, fileUrl, content, seq, status } = req.body;

  const updated = await collateralService.updateCollateral(id, {
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
