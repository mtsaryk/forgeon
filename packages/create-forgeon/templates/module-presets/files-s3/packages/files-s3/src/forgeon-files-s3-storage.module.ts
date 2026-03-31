import { Module } from '@nestjs/common';
import { FilesS3ConfigModule } from './files-s3-config.module';
import { S3FilesStorageAdapter } from './s3-files-storage.adapter';

const FORGEON_FILES_STORAGE_ADAPTER = 'FORGEON_FILES_STORAGE_ADAPTER';

@Module({
  imports: [FilesS3ConfigModule],
  providers: [
    S3FilesStorageAdapter,
    {
      provide: FORGEON_FILES_STORAGE_ADAPTER,
      useExisting: S3FilesStorageAdapter,
    },
  ],
  exports: [FilesS3ConfigModule, S3FilesStorageAdapter, FORGEON_FILES_STORAGE_ADAPTER],
})
export class ForgeonFilesS3StorageModule {}
