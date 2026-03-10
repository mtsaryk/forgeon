import { z } from 'zod';

export const schedulerEnvSchema = z
  .object({
    SCHEDULER_ENABLED: z.coerce.boolean().default(true),
    SCHEDULER_TIMEZONE: z.string().trim().min(1).default('UTC'),
    SCHEDULER_HEARTBEAT_CRON: z.string().trim().min(1).default('*/5 * * * *'),
  })
  .passthrough();

export type SchedulerEnv = z.infer<typeof schedulerEnvSchema>;

export function parseSchedulerEnv(input: Record<string, unknown>): SchedulerEnv {
  return schedulerEnvSchema.parse(input);
}
