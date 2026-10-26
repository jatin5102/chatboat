import { Router } from "express";
import { validate } from "../../middlewares/validate.js";
import * as projectCtrl from "./project.controller.js";
import { createProjectSchema, updateProjectSchema, createGallerySchema } from "./project.schema.js";

const router = Router();

// Projects
router.get("/", projectCtrl.getList);
router.post("/", validate(createProjectSchema), projectCtrl.create);
router.get("/:id", projectCtrl.getById);
router.put("/:id", validate(updateProjectSchema), projectCtrl.update);
router.delete("/:id", projectCtrl.destroy);

// Documents setting & management
router.post("/:id/documents", projectCtrl.setDocuments);
router.put("/:id/set-document", projectCtrl.setDocuments);
router.patch("/:id/documents", projectCtrl.setDocuments);

// Gallery / Media collaterals
router.get("/:projectId/gallery", projectCtrl.getGallery);
router.post("/:projectId/gallery", validate(createGallerySchema), projectCtrl.addGalleryItem);
router.put("/gallery/:id", projectCtrl.updateGalleryItem);
router.delete("/gallery/:id", projectCtrl.deleteGalleryItem);

export { router as ProjectRoutes };
