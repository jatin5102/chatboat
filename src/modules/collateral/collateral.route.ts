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

const mediaItemUpload = upload.fields([
    { name: "file", maxCount: 1 },
    { name: "fileUrl", maxCount: 1 },
]);

// Media Management per Collateral (Fetch, Upload/Add, Remove, Update)
router.get("/:id/media", getCollateralMedia);
router.post("/:id/media", upload.array("files", 15), addCollateralMedia);
router.delete("/:id/media/:mediaId", removeCollateralMedia);
router.patch("/:id/media/:mediaId", mediaItemUpload, updateCollateralMedia);
router.put("/:id/media/:mediaId", mediaItemUpload, updateCollateralMedia);

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

const collateralFilesUpload = upload.fields([
    { name: "icon", maxCount: 1 },
    { name: "fileUrl", maxCount: 1 },
    { name: "file", maxCount: 1 },
]);

router.get("/:id", getCollateralById);
router.post("/", collateralFilesUpload, createCollateral);
router.put("/:id", collateralFilesUpload, updateCollateral);
router.patch("/:id", collateralFilesUpload, updateCollateral);
router.patch("/:id/status", toggleCollateralStatus);
router.delete("/:id", deleteCollateral);

export const CollateralRoutes = router;
