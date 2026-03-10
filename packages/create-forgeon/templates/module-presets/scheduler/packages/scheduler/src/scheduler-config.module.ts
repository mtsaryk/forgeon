import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { schedulerConfig } from './scheduler-config.loader';
import { SchedulerConfigService } from './scheduler-config.service';

@Module({
  imports: [ConfigModule.forFeature(schedulerConfig)],
  providers: [SchedulerConfigService],
  exports: [ConfigModule, SchedulerConfigService],
})
export class SchedulerConfigModule {}
