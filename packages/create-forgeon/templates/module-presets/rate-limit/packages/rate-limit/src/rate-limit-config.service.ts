import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RATE_LIMIT_CONFIG_NAMESPACE,
  RateLimitConfigValues,
} from './rate-limit-config.loader';

@Injectable()
export class RateLimitConfigService {
  constructor(private readonly configService: ConfigService) {}

  get enabled(): boolean {
    return this.configService.getOrThrow<boolean>(`${RATE_LIMIT_CONFIG_NAMESPACE}.enabled`);
  }

  get ttlSeconds(): RateLimitConfigValues['ttlSeconds'] {
    return this.configService.getOrThrow<RateLimitConfigValues['ttlSeconds']>(
      `${RATE_LIMIT_CONFIG_NAMESPACE}.ttlSeconds`,
    );
  }

  get ttlMs(): number {
    return this.ttlSeconds * 1000;
  }

  get limit(): RateLimitConfigValues['limit'] {
    return this.configService.getOrThrow<RateLimitConfigValues['limit']>(
      `${RATE_LIMIT_CONFIG_NAMESPACE}.limit`,
    );
  }

  get trustProxy(): boolean {
    return this.configService.getOrThrow<boolean>(`${RATE_LIMIT_CONFIG_NAMESPACE}.trustProxy`);
  }
}
