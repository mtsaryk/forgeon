import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { filesQuotasConfig } from './files-quotas-config.loader';
import { FilesQuotasConfigService } from './files-quotas-config.service';

@Module({
  imports: [ConfigModule.forFeature(filesQuotasConfig)],
  providers: [FilesQuotasConfigService],
  exports: [FilesQuotasConfigService],
})
export class FilesQuotasConfigModule {}
