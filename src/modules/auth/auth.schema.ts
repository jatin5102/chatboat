import { z } from 'zod';

export const registerSchema = z.object({
	body: z.object({
		name: z.string().min(1),
		email: z.string().email(),
		password: z.string().min(6),
		role: z.enum(['ADMIN', 'SEO', 'USER']).optional(),
	}),
});

export const loginSchema = z.object({
	body: z.object({
		email: z.string().email(),
		password: z.string().min(6),
	}),
});

export const updatePasswordSchema = z.object({
	body: z.object({
		email: z.string().email('Valid email is required'),
		newPassword: z.string().min(6, 'Password must be at least 6 characters'),
	}),
});

export const forgotPasswordSchema = z.object({
	body: z.object({
		email: z.string().email('Valid email is required'),
	}),
});

export const resetPasswordSchema = z.object({
	body: z.object({
		token: z.string().min(1, 'Reset token is required'),
		newPassword: z.string().min(6, 'Password must be at least 6 characters'),
	}),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>['body'];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>['body'];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>['body'];



