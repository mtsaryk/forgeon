import { Module } from '@nestjs/common';
import { FilesAccessService } from './files-access.service';

@Module({
  providers: [FilesAccessService],
  exports: [FilesAccessService],
})
export class ForgeonFilesAccessModule {}
