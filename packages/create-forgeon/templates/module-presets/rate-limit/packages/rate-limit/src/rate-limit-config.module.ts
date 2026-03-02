import { Module } from '@nestjs/common';
import { RateLimitConfigService } from './rate-limit-config.service';

@Module({
  providers: [RateLimitConfigService],
  exports: [RateLimitConfigService],
})
export class RateLimitConfigModule {}
