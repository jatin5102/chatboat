import asyncHandler from "express-async-handler";
import type { Request, Response } from "express";
import * as authService from "./auth.service.js";
import { successResponse } from "../../utils/responseHandler.utils.js";
import { ApiError } from "../../utils/apiError.utils.js";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma.config.js";
import { setAuthCookies } from "../../utils/cookie.utils.js";
import { signRefreshToken, signAccessToken } from "../../utils/token.utils.js";
import { ENV } from "../../config/env.config.js";
import bcrypt from "bcrypt";
import { sendPasswordUpdateEmail } from "../../utils/email.utils.js";

export const register = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.registerUser(req.body);
    successResponse(res, 201, "User registered successfully", result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
    const { user, accessToken, refreshToken } = await authService.loginUser(
        req.body.email,
        req.body.password,
    );

    setAuthCookies(res, accessToken, refreshToken);

    successResponse(res, 200, "Login successful", { user, accessToken, refreshToken });
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
    let token = req.cookies?.refreshToken;

    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
    }

    if (!token) throw new ApiError(401, "No refresh token");

    // ✅ Verify JWT signature FIRST before touching DB
    const payload = jwt.verify(token, ENV.REFRESH_TOKEN_SECRET) as { id: string; role: string };

    const stored = await prisma.refreshToken.findUnique({
        where: { token },
        include: {
            user: {
                select: { id: true, email: true, name: true, role: true },
            },
        },
    });

    if (!stored) throw new ApiError(401, "Invalid refresh token");
    if (stored.expiresAt < new Date()) {
        await prisma.refreshToken.delete({ where: { token } }); // ✅ cleanup expired
        throw new ApiError(401, "Refresh token expired");
    }

    // ✅ Token rotation — delete old, issue new refresh token
    await prisma.refreshToken.delete({ where: { token } });

    const newAccessToken = signAccessToken({ id: stored.user.id, role: stored.user.role });
    const newRefreshToken = signRefreshToken({ id: stored.user.id });

    await prisma.refreshToken.create({
        data: {
            token: newRefreshToken,
            userId: stored.user.id,
            expiresAt: new Date(Date.now() + ENV.REFRESH_TOKEN_EXPIRY_MS),
        },
    });

    setAuthCookies(res, newAccessToken, newRefreshToken); // ✅ rotate cookies too

    successResponse(res, 200, "Token refreshed", {
        user: stored.user,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken, // send new refresh token for non-cookie clients
    });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
    let token = req.cookies?.refreshToken;
    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        } else {
            token = authHeader;
        }
    }

    if (token) {
        await prisma.refreshToken.deleteMany({ where: { token } });
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    successResponse(res, 200, "Logged out successfully");
});

export const updatePassword = asyncHandler(async (req: Request, res: Response) => {
    const { newPassword, email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(404, "User not found");

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { email },
        data: { password: hashed },
    });

    // await sendPasswordUpdateEmail(email, newPassword);

    successResponse(res, 200, "Password updated successfully");
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.forgotPassword(req.body.email);
    successResponse(res, 200, result.message);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.resetPassword(req.body.token, req.body.newPassword);
    successResponse(res, 200, result.message);
});
