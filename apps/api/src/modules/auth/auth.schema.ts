import { z } from 'zod';

export const registerSchema = z.object({
  org_name: z.string().min(2).max(100),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['admin', 'manager', 'user']).default('user'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  password: z.string().min(8).max(128).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
