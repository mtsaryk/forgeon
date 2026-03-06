import { registerAs } from '@nestjs/config';
import { parseQueueEnv } from './queue-env.schema';

export const QUEUE_CONFIG_NAMESPACE = 'queue';

export interface QueueConfigValues {
  enabled: boolean;
  redisUrl: string;
  prefix: string;
  defaultAttempts: number;
  defaultBackoffMs: number;
}

export const queueConfig = registerAs(QUEUE_CONFIG_NAMESPACE, (): QueueConfigValues => {
  const env = parseQueueEnv(process.env);

  return {
    enabled: env.QUEUE_ENABLED,
    redisUrl: env.QUEUE_REDIS_URL,
    prefix: env.QUEUE_PREFIX,
    defaultAttempts: env.QUEUE_DEFAULT_ATTEMPTS,
    defaultBackoffMs: env.QUEUE_DEFAULT_BACKOFF_MS,
  };
});
