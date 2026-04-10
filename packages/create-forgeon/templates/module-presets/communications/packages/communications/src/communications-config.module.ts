import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { communicationsConfig } from './communications-config.loader';
import { CommunicationsConfigService } from './communications-config.service';

@Module({
  imports: [ConfigModule.forFeature(communicationsConfig)],
  providers: [CommunicationsConfigService],
  exports: [ConfigModule, CommunicationsConfigService],
})
export class CommunicationsConfigModule {}
