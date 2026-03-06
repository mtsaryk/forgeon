import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FilesConfigValue } from './files-config.loader';

@Injectable()
export class FilesConfigService {
  constructor(private readonly configService: ConfigService) {}

  get enabled(): boolean {
    return this.configService.getOrThrow<FilesConfigValue['enabled']>('files.enabled');
  }

  get storageDriver(): FilesConfigValue['storageDriver'] {
    return this.configService.getOrThrow<FilesConfigValue['storageDriver']>('files.storageDriver');
  }

  get publicBasePath(): string {
    return this.configService.getOrThrow<FilesConfigValue['publicBasePath']>('files.publicBasePath');
  }
}
