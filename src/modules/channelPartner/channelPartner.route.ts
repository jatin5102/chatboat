import { Router } from "express";
import { validate } from "../../middlewares/validate.js";
import * as cpCtrl from "./channelPartner.controller.js";
import { createChannelPartnerSchema, updateChannelPartnerSchema } from "./channelPartner.schema.js";

const router = Router();

router.get("/", cpCtrl.getList);
router.post("/", validate(createChannelPartnerSchema), cpCtrl.create);
router.get("/:id", cpCtrl.getById);
router.put("/:id", validate(updateChannelPartnerSchema), cpCtrl.update);
router.delete("/:id", cpCtrl.destroy);

export { router as ChannelPartnerRoutes };
