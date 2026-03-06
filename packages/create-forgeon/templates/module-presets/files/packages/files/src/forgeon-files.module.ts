import { Module } from '@nestjs/common';
import { FilesConfigModule } from './files-config.module';

@Module({
  imports: [FilesConfigModule],
  exports: [FilesConfigModule],
})
export class ForgeonFilesModule {}
