import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SwaggerConfigService } from './swagger-config.service';

@Module({
  imports: [ConfigModule],
  providers: [SwaggerConfigService],
  exports: [SwaggerConfigService],
})
export class SwaggerConfigModule {}

