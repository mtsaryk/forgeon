import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FILES_IMAGE_CONFIG_NAMESPACE,
  FilesImageConfigValues,
} from './files-image-config.loader';

@Injectable()
export class FilesImageConfigService {
  constructor(private readonly configService: ConfigService) {}

  get enabled(): boolean {
    return this.configService.getOrThrow<boolean>(`${FILES_IMAGE_CONFIG_NAMESPACE}.enabled`);
  }

  get stripMetadata(): boolean {
    return this.configService.getOrThrow<boolean>(`${FILES_IMAGE_CONFIG_NAMESPACE}.stripMetadata`);
  }

  get maxWidth(): FilesImageConfigValues['maxWidth'] {
    return this.configService.getOrThrow<FilesImageConfigValues['maxWidth']>(
      `${FILES_IMAGE_CONFIG_NAMESPACE}.maxWidth`,
    );
  }

  get maxHeight(): FilesImageConfigValues['maxHeight'] {
    return this.configService.getOrThrow<FilesImageConfigValues['maxHeight']>(
      `${FILES_IMAGE_CONFIG_NAMESPACE}.maxHeight`,
    );
  }

  get maxPixels(): FilesImageConfigValues['maxPixels'] {
    return this.configService.getOrThrow<FilesImageConfigValues['maxPixels']>(
      `${FILES_IMAGE_CONFIG_NAMESPACE}.maxPixels`,
    );
  }

  get maxFrames(): FilesImageConfigValues['maxFrames'] {
    return this.configService.getOrThrow<FilesImageConfigValues['maxFrames']>(
      `${FILES_IMAGE_CONFIG_NAMESPACE}.maxFrames`,
    );
  }

  get processTimeoutMs(): FilesImageConfigValues['processTimeoutMs'] {
    return this.configService.getOrThrow<FilesImageConfigValues['processTimeoutMs']>(
      `${FILES_IMAGE_CONFIG_NAMESPACE}.processTimeoutMs`,
    );
  }

  get allowedMimeTypes(): FilesImageConfigValues['allowedMimeTypes'] {
    return this.configService.getOrThrow<FilesImageConfigValues['allowedMimeTypes']>(
      `${FILES_IMAGE_CONFIG_NAMESPACE}.allowedMimeTypes`,
    );
  }
}
