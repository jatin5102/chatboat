import { Router } from "express";
import { validate } from "../../middlewares/validate.js";
import * as platterCtrl from "./platter.controller.js";
import { createPlatterSchema, updatePlatterSchema } from "./platter.schema.js";

const router = Router();

router.get("/", platterCtrl.getList);
router.post("/", validate(createPlatterSchema), platterCtrl.create);
router.get("/:id", platterCtrl.getById);
router.put("/:id", validate(updatePlatterSchema), platterCtrl.update);
router.delete("/:id", platterCtrl.destroy);

export { router as PlatterRoutes };
