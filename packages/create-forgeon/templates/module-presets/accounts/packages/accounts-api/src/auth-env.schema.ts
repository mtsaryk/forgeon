import { z } from 'zod';

export const authEnvSchema = z
  .object({
    JWT_ACCESS_SECRET: z.string().trim().min(16).default('forgeon-access-secret-change-me'),
    JWT_ACCESS_EXPIRES_IN: z.string().trim().min(2).default('15m'),
    JWT_REFRESH_SECRET: z.string().trim().min(16).default('forgeon-refresh-secret-change-me'),
    JWT_REFRESH_EXPIRES_IN: z.string().trim().min(2).default('7d'),
    AUTH_ARGON2_MEMORY_COST: z.coerce.number().int().min(1024).default(19456),
    AUTH_ARGON2_TIME_COST: z.coerce.number().int().min(1).default(2),
    AUTH_ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1)
  })
  .passthrough();

export type AuthEnv = z.infer<typeof authEnvSchema>;

export function parseAuthEnv(input: Record<string, unknown>): AuthEnv {
  return authEnvSchema.parse(input);
}
