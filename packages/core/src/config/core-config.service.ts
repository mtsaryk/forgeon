import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CORE_CONFIG_NAMESPACE } from './core-config.loader';
import type { CoreConfigValues } from './core-config.loader';

@Injectable()
export class CoreConfigService {
  constructor(private readonly configService: ConfigService) {}

  get nodeEnv(): CoreConfigValues['nodeEnv'] {
    return this.configService.getOrThrow<CoreConfigValues['nodeEnv']>(
      `${CORE_CONFIG_NAMESPACE}.nodeEnv`,
    );
  }

  get port(): number {
    return this.configService.getOrThrow<number>(`${CORE_CONFIG_NAMESPACE}.port`);
  }

  get apiPrefix(): string {
    return this.configService.getOrThrow<string>(
      `${CORE_CONFIG_NAMESPACE}.apiPrefix`,
    );
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}
