import { Router } from "express";
import { validate } from "../../middlewares/validate.js";
import * as cpCtrl from "./channelPartner.controller.js";
import { createChannelPartnerSchema, updateChannelPartnerSchema } from "./channelPartner.schema.js";
import { upload } from "../../middlewares/upload.middleware.js";

const router = Router();

router.get("/", cpCtrl.getList);
router.post("/", upload.none(), validate(createChannelPartnerSchema), cpCtrl.create);
router.get("/:id", cpCtrl.getById);
router.put("/:id", upload.none(), validate(updateChannelPartnerSchema), cpCtrl.update);
router.delete("/:id", cpCtrl.destroy);

export { router as ChannelPartnerRoutes };
