import { z } from 'zod';

export const queueEnvSchema = z
  .object({
    QUEUE_ENABLED: z.coerce.boolean().default(true),
    QUEUE_REDIS_URL: z.string().trim().min(1).default('redis://localhost:6379'),
    QUEUE_PREFIX: z.string().trim().min(1).default('forgeon'),
    QUEUE_DEFAULT_ATTEMPTS: z.coerce.number().int().positive().default(3),
    QUEUE_DEFAULT_BACKOFF_MS: z.coerce.number().int().nonnegative().default(1000),
  })
  .passthrough();

export type QueueEnv = z.infer<typeof queueEnvSchema>;

export function parseQueueEnv(input: Record<string, unknown>): QueueEnv {
  return queueEnvSchema.parse(input);
}
