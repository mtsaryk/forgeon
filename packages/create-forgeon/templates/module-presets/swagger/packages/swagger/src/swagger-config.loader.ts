import { registerAs } from '@nestjs/config';
import { parseSwaggerEnv } from './swagger-env.schema';

export const SWAGGER_CONFIG_NAMESPACE = 'swagger';

export interface SwaggerConfigValues {
  enabled: boolean;
  path: string;
  title: string;
  version: string;
}

export const swaggerConfig = registerAs(SWAGGER_CONFIG_NAMESPACE, (): SwaggerConfigValues => {
  const env = parseSwaggerEnv(process.env);
  return {
    enabled: env.SWAGGER_ENABLED,
    path: env.SWAGGER_PATH.replace(/^\/+/, ''),
    title: env.SWAGGER_TITLE,
    version: env.SWAGGER_VERSION,
  };
});

