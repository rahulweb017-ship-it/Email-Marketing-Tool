import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(200),
  scopes: z.array(z.enum([
    'contacts:read', 'contacts:write',
    'campaigns:read', 'campaigns:write',
    'lists:read', 'lists:write',
    'analytics:read',
  ])).min(1),
  expires_in_days: z.number().min(1).max(365).optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
