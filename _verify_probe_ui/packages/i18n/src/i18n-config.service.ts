import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18N_CONFIG_NAMESPACE } from './i18n-config.loader';

@Injectable()
export class I18nConfigService {
  constructor(private readonly configService: ConfigService) {}

  get defaultLang(): string {
    return this.configService.getOrThrow<string>(
      `${I18N_CONFIG_NAMESPACE}.defaultLang`,
    );
  }

  get fallbackLang(): string {
    return this.configService.getOrThrow<string>(
      `${I18N_CONFIG_NAMESPACE}.fallbackLang`,
    );
  }
}
