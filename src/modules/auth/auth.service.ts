import { prisma } from "../../config/prisma.config.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { Role } from "../../generated/prisma/enums.js";
import { signAccessToken, signRefreshToken } from "../../utils/token.utils.js";
import { ENV } from "../../config/env.config.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { sendForgotPasswordEmail, sendPasswordResetSuccessEmail } from "../../utils/email.utils.js";

const SALT_ROUNDS = 10;

export async function registerUser(data: {
    name?: string;
    email: string;
    password: string;
    role?: Role;
}) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error("Email already exists");

    const hashed = await bcrypt.hash(data.password, SALT_ROUNDS);

    const user = await prisma.user.create({
        data: {
            email: data.email,
            name: data.name,
            password: hashed,
            role: data.role ? (data.role.toUpperCase() as Role) : Role.USER,
        },
    });

    return user;
}

export async function loginUser(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(404, "User not found");

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new ApiError(400, "Password incorrect");

    const accessToken = signAccessToken({ id: user.id, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id });

    await prisma.refreshToken.create({
        data: {
            token: refreshToken,
            userId: user.id,
            expiresAt: new Date(Date.now() + ENV.REFRESH_TOKEN_EXPIRY_MS), // ✅ from env
        },
    });

    return {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        accessToken,
        refreshToken,
    };
}

export async function forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(404, "User with this email does not exist");

    // Generate secure raw token & store SHA-256 hashed version for security
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    await prisma.user.update({
        where: { email },
        data: {
            resetPasswordToken: hashedToken,
            resetPasswordExpires: expiresAt,
        },
    });

    const resetUrl = `${ENV.FRONTEND_URL}/admin/reset-password?token=${rawToken}`;
    // await sendForgotPasswordEmail(email, resetUrl, rawToken);

    return { message: "Password reset link sent to your email" };
}

export async function resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await prisma.user.findFirst({
        where: {
            resetPasswordToken: hashedToken,
            resetPasswordExpires: {
                gte: new Date(),
            },
        },
    });

    if (!user) {
        throw new ApiError(400, "Invalid or expired password reset token");
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedNewPassword,
            resetPasswordToken: null,
            resetPasswordExpires: null,
        },
    });

    // Revoke all existing sessions for security
    await prisma.refreshToken.deleteMany({
        where: { userId: user.id },
    });

    await sendPasswordResetSuccessEmail(user.email);

    return { message: "Password reset successfully" };
}
