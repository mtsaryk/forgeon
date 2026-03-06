import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { filesLocalConfig } from './files-local-config.loader';
import { FilesLocalConfigService } from './files-local-config.service';

@Global()
@Module({
  imports: [ConfigModule.forFeature(filesLocalConfig)],
  providers: [FilesLocalConfigService],
  exports: [FilesLocalConfigService],
})
export class FilesLocalConfigModule {}
