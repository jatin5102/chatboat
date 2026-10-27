import { Router } from "express";
import { validate } from "../../middlewares/validate.js";
import { upload } from "../../middlewares/upload.middleware.js";
import * as projectCtrl from "./project.controller.js";
import { createProjectSchema, updateProjectSchema } from "./project.schema.js";

const router = Router();

// Projects
router.get("/", projectCtrl.getList);
router.post("/", validate(createProjectSchema), projectCtrl.create);
router.get("/:id", projectCtrl.getById);
router.put("/:id", validate(updateProjectSchema), projectCtrl.update);
router.delete("/:id", projectCtrl.destroy);

// Documents setting & management (supports JSON or multipart file upload)
router.post("/:id/documents", upload.single("file"), projectCtrl.setDocuments);
router.put("/:id/set-document", upload.single("file"), projectCtrl.setDocuments);
router.patch("/:id/documents", upload.single("file"), projectCtrl.setDocuments);

export { router as ProjectRoutes };
