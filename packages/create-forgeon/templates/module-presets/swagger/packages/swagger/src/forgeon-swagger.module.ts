import { Module } from '@nestjs/common';
import { SwaggerConfigModule } from './swagger-config.module';

@Module({
  imports: [SwaggerConfigModule],
  exports: [SwaggerConfigModule],
})
export class ForgeonSwaggerModule {}

