import { Module } from '@nestjs/common';
import { QueueConfigModule } from './queue-config.module';
import { QueueService } from './queue.service';

@Module({
  imports: [QueueConfigModule],
  providers: [QueueService],
  exports: [QueueConfigModule, QueueService],
})
export class ForgeonQueueModule {}
