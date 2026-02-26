import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LOGGER_CONFIG_NAMESPACE, LoggerConfigValues } from './logger-config.loader';

@Injectable()
export class LoggerConfigService {
  constructor(private readonly configService: ConfigService) {}

  get level(): LoggerConfigValues['level'] {
    return this.configService.getOrThrow<LoggerConfigValues['level']>(
      `${LOGGER_CONFIG_NAMESPACE}.level`,
    );
  }

  get httpEnabled(): boolean {
    return this.configService.getOrThrow<boolean>(`${LOGGER_CONFIG_NAMESPACE}.httpEnabled`);
  }

  get requestIdHeader(): string {
    return this.configService.getOrThrow<string>(`${LOGGER_CONFIG_NAMESPACE}.requestIdHeader`);
  }
}

