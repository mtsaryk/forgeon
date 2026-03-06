import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { filesConfig } from './files-config.loader';
import { FilesConfigService } from './files-config.service';

@Global()
@Module({
  imports: [ConfigModule.forFeature(filesConfig)],
  providers: [FilesConfigService],
  exports: [FilesConfigService],
})
export class FilesConfigModule {}
