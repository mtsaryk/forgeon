import { z } from 'zod';

export const rateLimitEnvSchema = z
  .object({
    THROTTLE_ENABLED: z.coerce.boolean().default(true),
    THROTTLE_TTL: z.coerce.number().int().positive().default(10),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(3),
    THROTTLE_TRUST_PROXY: z.coerce.boolean().default(false),
  })
  .passthrough();

export type RateLimitEnv = z.infer<typeof rateLimitEnvSchema>;

export function parseRateLimitEnv(input: Record<string, unknown>): RateLimitEnv {
  return rateLimitEnvSchema.parse(input);
}
