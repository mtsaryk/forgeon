import { registerAs } from '@nestjs/config';
import { parseSchedulerEnv } from './scheduler-env.schema';

export const SCHEDULER_CONFIG_NAMESPACE = 'scheduler';

export type SchedulerConfigValues = {
  enabled: boolean;
  timezone: string;
  heartbeatCron: string;
};

export const schedulerConfig = registerAs(
  SCHEDULER_CONFIG_NAMESPACE,
  (): SchedulerConfigValues => {
    const env = parseSchedulerEnv(process.env as unknown as Record<string, unknown>);

    return {
      enabled: env.SCHEDULER_ENABLED,
      timezone: env.SCHEDULER_TIMEZONE,
      heartbeatCron: env.SCHEDULER_HEARTBEAT_CRON,
    };
  },
);
