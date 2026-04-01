import { Module } from '@nestjs/common';
import { DbPrismaModule } from '@forgeon/db-prisma';
import { FilesStore } from '@forgeon/files';
import { FilesQuotasConfigModule } from './files-quotas-config.module';
import { FilesQuotasService } from './files-quotas.service';

const FORGEON_FILES_UPLOAD_QUOTA_SERVICE = 'FORGEON_FILES_UPLOAD_QUOTA_SERVICE';

@Module({
  imports: [DbPrismaModule, FilesQuotasConfigModule],
  providers: [
    FilesStore,
    FilesQuotasService,
    {
      provide: FORGEON_FILES_UPLOAD_QUOTA_SERVICE,
      useExisting: FilesQuotasService,
    },
  ],
  exports: [FilesQuotasConfigModule, FilesQuotasService, FORGEON_FILES_UPLOAD_QUOTA_SERVICE],
})
export class ForgeonFilesQuotasModule {}