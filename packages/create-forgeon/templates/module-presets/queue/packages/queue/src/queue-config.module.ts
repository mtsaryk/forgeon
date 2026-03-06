import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueConfigService } from './queue-config.service';

@Module({
  imports: [ConfigModule],
  providers: [QueueConfigService],
  exports: [QueueConfigService],
})
export class QueueConfigModule {}
