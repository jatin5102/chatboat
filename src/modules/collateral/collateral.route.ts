import { Router } from "express";
import {
  getCollaterals,
  getActivePlatterCollaterals,
  initPlatterCollaterals,
  configurePlatterCollaterals,
  getActiveProjectCollaterals,
  getCollateralById,
  createCollateral,
  updateCollateral,
  toggleCollateralStatus,
  configureProjectCollaterals,
  initProjectCollaterals,
  deleteCollateral,
  getCollateralMedia,
  addCollateralMedia,
  removeCollateralMedia,
  updateCollateralMedia,
} from "./collateral.controller.js";
import { upload } from "../../middlewares/upload.middleware.js";

const router = Router();

router.get("/", getCollaterals);

// Media Management per Collateral (Fetch, Upload/Add, Remove, Update)
router.get("/:id/media", getCollateralMedia);
router.post("/:id/media", upload.array("files", 15), addCollateralMedia);
router.delete("/:id/media/:mediaId", removeCollateralMedia);
router.delete("/media/:mediaId", removeCollateralMedia);
router.patch("/:id/media/:mediaId", updateCollateralMedia);
router.patch("/media/:mediaId", updateCollateralMedia);
  
// Platter-referenced collaterals
router.get("/platter/:platterId", getActivePlatterCollaterals);
router.post("/platter/:platterId/init", initPlatterCollaterals);
router.put("/platter/:platterId/configure", configurePlatterCollaterals);
router.patch("/platter/:platterId/configure", configurePlatterCollaterals);

// Project-referenced collaterals
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
