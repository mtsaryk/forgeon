import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SWAGGER_CONFIG_NAMESPACE, SwaggerConfigValues } from './swagger-config.loader';

@Injectable()
export class SwaggerConfigService {
  constructor(private readonly configService: ConfigService) {}

  get enabled(): boolean {
    return this.configService.getOrThrow<boolean>(`${SWAGGER_CONFIG_NAMESPACE}.enabled`);
  }

  get path(): string {
    return this.configService.getOrThrow<string>(`${SWAGGER_CONFIG_NAMESPACE}.path`);
  }

  get title(): string {
    return this.configService.getOrThrow<SwaggerConfigValues['title']>(
      `${SWAGGER_CONFIG_NAMESPACE}.title`,
    );
  }

  get version(): string {
    return this.configService.getOrThrow<SwaggerConfigValues['version']>(
      `${SWAGGER_CONFIG_NAMESPACE}.version`,
    );
  }
}

