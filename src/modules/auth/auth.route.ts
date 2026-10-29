import { Router } from "express";
import * as authCtrl from "./auth.controller.js";
import { validate } from "../../middlewares/validate.js";
import {
    registerSchema,
    loginSchema,
    updatePasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
} from "./auth.schema.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", validate(registerSchema), authCtrl.register);
router.post("/login", validate(loginSchema), authCtrl.login);
router.post("/refresh", authCtrl.refreshToken);
router.post("/logout", authCtrl.logout);
router.post("/forgot-password", validate(forgotPasswordSchema), authCtrl.forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), authCtrl.resetPassword);
router.put(
    "/update-password",
    authenticate,
    authorize(["ADMIN"]),
    validate(updatePasswordSchema),
    authCtrl.updatePassword,
);

export { router as authRoutes };
