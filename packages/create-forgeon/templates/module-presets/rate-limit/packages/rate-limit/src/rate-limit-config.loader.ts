import { registerAs } from '@nestjs/config';
import { parseRateLimitEnv } from './rate-limit-env.schema';

export const RATE_LIMIT_CONFIG_NAMESPACE = 'rateLimit';

export interface RateLimitConfigValues {
  enabled: boolean;
  ttlSeconds: number;
  limit: number;
  trustProxy: boolean;
}

export const rateLimitConfig = registerAs(
  RATE_LIMIT_CONFIG_NAMESPACE,
  (): RateLimitConfigValues => {
    const env = parseRateLimitEnv(process.env);

    return {
      enabled: env.THROTTLE_ENABLED,
      ttlSeconds: env.THROTTLE_TTL,
      limit: env.THROTTLE_LIMIT,
      trustProxy: env.THROTTLE_TRUST_PROXY,
    };
  },
);
