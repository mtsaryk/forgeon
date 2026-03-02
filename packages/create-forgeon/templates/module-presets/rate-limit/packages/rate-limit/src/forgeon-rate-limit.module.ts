import { Module, OnModuleInit } from '@nestjs/common';
import { APP_GUARD, HttpAdapterHost } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RateLimitConfigModule } from './rate-limit-config.module';
import { RateLimitConfigService } from './rate-limit-config.service';

@Module({
  imports: [
    RateLimitConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [RateLimitConfigModule],
      inject: [RateLimitConfigService],
      useFactory: (config: RateLimitConfigService) => ({
        errorMessage: 'Too many requests. Please try again later.',
        skipIf: () => !config.enabled,
        throttlers: [
          {
            ttl: config.ttlMs,
            limit: config.limit,
          },
        ],
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [RateLimitConfigModule],
})
export class ForgeonRateLimitModule implements OnModuleInit {
  constructor(
    private readonly rateLimitConfig: RateLimitConfigService,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  onModuleInit(): void {
    if (!this.rateLimitConfig.trustProxy) {
      return;
    }

    const adapter = this.httpAdapterHost.httpAdapter;
    const instance = adapter?.getInstance?.();
    if (instance && typeof instance.set === 'function') {
      instance.set('trust proxy', true);
    }
  }
}
