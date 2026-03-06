import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FilesS3ConfigValue } from './files-s3-config.loader';

@Injectable()
export class FilesS3ConfigService {
  constructor(private readonly configService: ConfigService) {}

  get bucket(): string {
    return this.configService.getOrThrow<FilesS3ConfigValue['bucket']>('filesS3.bucket');
  }

  get providerPreset(): FilesS3ConfigValue['providerPreset'] {
    return this.configService.getOrThrow<FilesS3ConfigValue['providerPreset']>('filesS3.providerPreset');
  }

  get region(): string {
    return this.configService.getOrThrow<FilesS3ConfigValue['region']>('filesS3.region');
  }

  get endpoint(): string | undefined {
    return this.configService.get<FilesS3ConfigValue['endpoint']>('filesS3.endpoint');
  }

  get accessKeyId(): string {
    return this.configService.getOrThrow<FilesS3ConfigValue['accessKeyId']>('filesS3.accessKeyId');
  }

  get secretAccessKey(): string {
    return this.configService.getOrThrow<FilesS3ConfigValue['secretAccessKey']>(
      'filesS3.secretAccessKey',
    );
  }

  get forcePathStyle(): boolean {
    return this.configService.getOrThrow<FilesS3ConfigValue['forcePathStyle']>(
      'filesS3.forcePathStyle',
    );
  }

  get maxAttempts(): number {
    return this.configService.getOrThrow<FilesS3ConfigValue['maxAttempts']>('filesS3.maxAttempts');
  }
}
