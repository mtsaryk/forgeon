import { Module } from '@nestjs/common';
import { ForgeonFilesModule } from '@forgeon/files';
import { FilesQuotasConfigModule } from './files-quotas-config.module';
import { FilesQuotasService } from './files-quotas.service';

@Module({
  imports: [ForgeonFilesModule, FilesQuotasConfigModule],
  providers: [FilesQuotasService],
  exports: [FilesQuotasConfigModule, FilesQuotasService],
})
export class ForgeonFilesQuotasModule {}
