import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { filesS3Config } from './files-s3-config.loader';
import { FilesS3ConfigService } from './files-s3-config.service';

@Global()
@Module({
  imports: [ConfigModule.forFeature(filesS3Config)],
  providers: [FilesS3ConfigService],
  exports: [FilesS3ConfigService],
})
export class FilesS3ConfigModule {}
