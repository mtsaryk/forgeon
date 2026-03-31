import { Module } from '@nestjs/common';
import { FilesLocalConfigModule } from './files-local-config.module';
import { LocalFilesStorageAdapter } from './local-files-storage.adapter';

const FORGEON_FILES_STORAGE_ADAPTER = 'FORGEON_FILES_STORAGE_ADAPTER';

@Module({
  imports: [FilesLocalConfigModule],
  providers: [
    LocalFilesStorageAdapter,
    {
      provide: FORGEON_FILES_STORAGE_ADAPTER,
      useExisting: LocalFilesStorageAdapter,
    },
  ],
  exports: [FilesLocalConfigModule, LocalFilesStorageAdapter, FORGEON_FILES_STORAGE_ADAPTER],
})
export class ForgeonFilesLocalStorageModule {}
