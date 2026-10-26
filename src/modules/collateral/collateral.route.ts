import { Router } from "express";
import {
  getCollaterals,
  getActiveProjectCollaterals,
  getCollateralById,
  createCollateral,
  updateCollateral,
  toggleCollateralStatus,
  deleteCollateral,
} from "./collateral.controller.js";

const router = Router();

router.get("/", getCollaterals);
router.get("/project/:projectId", getActiveProjectCollaterals);
router.get("/:id", getCollateralById);
router.post("/", createCollateral);
router.put("/:id", updateCollateral);
router.patch("/:id/status", toggleCollateralStatus);
router.delete("/:id", deleteCollateral);

export const CollateralRoutes = router;
