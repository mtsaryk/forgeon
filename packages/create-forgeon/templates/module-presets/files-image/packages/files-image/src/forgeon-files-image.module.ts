import { Module } from '@nestjs/common';
import { FilesImageConfigModule } from './files-image-config.module';
import { FilesImageService } from './files-image.service';

@Module({
  imports: [FilesImageConfigModule],
  providers: [FilesImageService],
  exports: [FilesImageConfigModule, FilesImageService],
})
export class ForgeonFilesImageModule {}
