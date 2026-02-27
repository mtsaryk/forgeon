import { z } from 'zod';

export const authEnvSchema = z
  .object({
    JWT_ACCESS_SECRET: z.string().trim().min(16).default('forgeon-access-secret-change-me'),
    JWT_ACCESS_EXPIRES_IN: z.string().trim().min(2).default('15m'),
    JWT_REFRESH_SECRET: z.string().trim().min(16).default('forgeon-refresh-secret-change-me'),
    JWT_REFRESH_EXPIRES_IN: z.string().trim().min(2).default('7d'),
    AUTH_BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
    AUTH_DEMO_EMAIL: z.string().trim().email().default('demo@forgeon.local'),
    AUTH_DEMO_PASSWORD: z.string().min(8).default('forgeon-demo-password'),
  })
  .passthrough();

export type AuthEnv = z.infer<typeof authEnvSchema>;

export function parseAuthEnv(input: Record<string, unknown>): AuthEnv {
  return authEnvSchema.parse(input);
}
