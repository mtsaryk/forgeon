import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerConfigService } from './logger-config.service';

@Module({
  imports: [ConfigModule],
  providers: [LoggerConfigService],
  exports: [LoggerConfigService],
})
export class LoggerConfigModule {}

