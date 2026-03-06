import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { filesImageConfig } from './files-image-config.loader';
import { FilesImageConfigService } from './files-image-config.service';

@Module({
  imports: [ConfigModule.forFeature(filesImageConfig)],
  providers: [FilesImageConfigService],
  exports: [FilesImageConfigService],
})
export class FilesImageConfigModule {}
