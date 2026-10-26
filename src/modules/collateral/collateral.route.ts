import { Router } from "express";
import {
  getCollaterals,
  getActiveProjectCollaterals,
  getCollateralById,
  createCollateral,
  updateCollateral,
  toggleCollateralStatus,
  configureProjectCollaterals,
  initProjectCollaterals,
  deleteCollateral,
} from "./collateral.controller.js";

const router = Router();

router.get("/", getCollaterals);
router.get("/project/:projectId", getActiveProjectCollaterals);
router.post("/project/:projectId/init", initProjectCollaterals);
router.put("/project/:projectId/configure", configureProjectCollaterals);
router.patch("/project/:projectId/configure", configureProjectCollaterals);
router.get("/:id", getCollateralById);
router.post("/", createCollateral);
router.put("/:id", updateCollateral);
router.patch("/:id/status", toggleCollateralStatus);
router.delete("/:id", deleteCollateral);

export const CollateralRoutes = router;
