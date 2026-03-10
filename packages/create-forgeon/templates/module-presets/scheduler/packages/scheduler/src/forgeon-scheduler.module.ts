import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ForgeonQueueModule } from '@forgeon/queue';
import { SchedulerConfigModule } from './scheduler-config.module';
import { ForgeonSchedulerService } from './scheduler.service';

@Module({
  imports: [ScheduleModule.forRoot(), ForgeonQueueModule, SchedulerConfigModule],
  providers: [ForgeonSchedulerService],
  exports: [SchedulerConfigModule, ForgeonSchedulerService],
})
export class ForgeonSchedulerModule {}
