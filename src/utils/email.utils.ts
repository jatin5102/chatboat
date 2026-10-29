import nodemailer from "nodemailer";
import { ENV } from "../config/env.config.js";

const transporter = nodemailer.createTransport({
    host: ENV.SMTP_HOST || "smtp.gmail.com",
    port: ENV.SMTP_PORT || 587,
    secure: (ENV.SMTP_PORT || 587) === 465,
    auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
    },
});

/**
 * Send password update notification email
 */
export async function sendPasswordUpdateEmail(email: string, newPassword?: string): Promise<void> {
    try {
        if (!ENV.SMTP_USER || !ENV.SMTP_PASS) {
            console.warn("[EmailUtils] SMTP credentials not fully configured; skipping email.");
            return;
        }

        await transporter.sendMail({
            from: ENV.FROM_EMAIL || ENV.SMTP_USER,
            to: email,
            subject: "Your Password Has Been Updated",
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2>Password Updated Successfully</h2>
                    <p>Hello,</p>
                    <p>Your account password has been updated successfully.</p>
                    ${newPassword ? `<p>Your updated password: <strong>${newPassword}</strong></p>` : ""}
                    <p>If you did not perform this action, please contact your administrator immediately.</p>
                </div>
            `,
        });
    } catch (error) {
        console.error("[EmailUtils] Error sending password update email:", error);
    }
}

/**
 * Send password reset link email
 */
export async function sendForgotPasswordEmail(
    email: string,
    resetUrl: string,
    rawToken: string,
): Promise<void> {
    try {
        if (!ENV.SMTP_USER || !ENV.SMTP_PASS) {
            console.warn(
                `[EmailUtils] SMTP not configured. Reset link for ${email}: ${resetUrl} (token: ${rawToken})`,
            );
            return;
        }

        await transporter.sendMail({
            from: ENV.FROM_EMAIL || ENV.SMTP_USER,
            to: email,
            subject: "Password Reset Request",
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2>Password Reset Request</h2>
                    <p>Hello,</p>
                    <p>We received a request to reset your password. Click the link below to reset it (valid for 15 minutes):</p>
                    <p><a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a></p>
                    <p>Or paste this link in your browser: <br/><code>${resetUrl}</code></p>
                    <p>If you did not request this, please ignore this email.</p>
                </div>
            `,
        });
    } catch (error) {
        console.error("[EmailUtils] Error sending forgot password email:", error);
    }
}

/**
 * Send password reset success confirmation email
 */
export async function sendPasswordResetSuccessEmail(email: string): Promise<void> {
    try {
        if (!ENV.SMTP_USER || !ENV.SMTP_PASS) {
            console.warn("[EmailUtils] SMTP not configured; skipping reset confirmation email.");
            return;
        }

        await transporter.sendMail({
            from: ENV.FROM_EMAIL || ENV.SMTP_USER,
            to: email,
            subject: "Password Successfully Reset",
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2>Password Reset Successful</h2>
                    <p>Hello,</p>
                    <p>Your password has been successfully reset. You can now log in with your new password.</p>
                </div>
            `,
        });
    } catch (error) {
        console.error("[EmailUtils] Error sending password reset confirmation email:", error);
    }
}

