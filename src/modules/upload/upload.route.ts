import { Router } from "express";
import { upload } from "../../middlewares/upload.middleware.js";
import { uploadSingleFile, uploadMultipleFiles } from "./upload.controller.js";

const router = Router();

// Single file upload: accepts field name 'file', 'image', 'document', or 'video'
router.post("/", upload.single("file"), uploadSingleFile);
router.post("/single", upload.single("file"), uploadSingleFile);
router.post("/document", upload.single("document"), uploadSingleFile);
router.post("/image", upload.single("image"), uploadSingleFile);
router.post("/video", upload.single("video"), uploadSingleFile);

// Multiple files upload: accepts field name 'files' (up to 15 files)
router.post("/multiple", upload.array("files", 15), uploadMultipleFiles);

export const UploadRoutes = router;
