import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesConfigModule } from './files-config.module';
import { FilesService } from './files.service';

@Module({
  imports: [FilesConfigModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesConfigModule, FilesService],
})
export class ForgeonFilesModule {}
