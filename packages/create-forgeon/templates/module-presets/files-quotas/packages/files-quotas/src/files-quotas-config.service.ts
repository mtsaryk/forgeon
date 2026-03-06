import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FILES_QUOTAS_CONFIG_NAMESPACE,
  FilesQuotasConfigValues,
} from './files-quotas-config.loader';

@Injectable()
export class FilesQuotasConfigService {
  constructor(private readonly configService: ConfigService) {}

  get enabled(): boolean {
    return this.configService.getOrThrow<boolean>(`${FILES_QUOTAS_CONFIG_NAMESPACE}.enabled`);
  }

  get maxFilesPerOwner(): FilesQuotasConfigValues['maxFilesPerOwner'] {
    return this.configService.getOrThrow<FilesQuotasConfigValues['maxFilesPerOwner']>(
      `${FILES_QUOTAS_CONFIG_NAMESPACE}.maxFilesPerOwner`,
    );
  }

  get maxBytesPerOwner(): FilesQuotasConfigValues['maxBytesPerOwner'] {
    return this.configService.getOrThrow<FilesQuotasConfigValues['maxBytesPerOwner']>(
      `${FILES_QUOTAS_CONFIG_NAMESPACE}.maxBytesPerOwner`,
    );
  }
}
