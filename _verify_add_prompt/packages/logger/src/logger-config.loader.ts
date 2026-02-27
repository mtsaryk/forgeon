import { registerAs } from '@nestjs/config';
import { LoggerLevel, parseLoggerEnv } from './logger-env.schema';

export const LOGGER_CONFIG_NAMESPACE = 'logger';

export interface LoggerConfigValues {
  level: LoggerLevel;
  httpEnabled: boolean;
  requestIdHeader: string;
}

export const loggerConfig = registerAs(LOGGER_CONFIG_NAMESPACE, (): LoggerConfigValues => {
  const env = parseLoggerEnv(process.env);
  return {
    level: env.LOGGER_LEVEL,
    httpEnabled: env.LOGGER_HTTP_ENABLED,
    requestIdHeader: env.LOGGER_REQUEST_ID_HEADER.toLowerCase(),
  };
});

