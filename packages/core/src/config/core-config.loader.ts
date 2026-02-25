import { registerAs } from '@nestjs/config';
import type { CoreEnv } from './core-env.schema';
import { parseCoreEnv } from './core-env.schema';

export const CORE_CONFIG_NAMESPACE = 'core';

export interface CoreConfigValues {
  nodeEnv: CoreEnv['NODE_ENV'];
  port: number;
  apiPrefix: string;
}

export const coreConfig = registerAs(
  CORE_CONFIG_NAMESPACE,
  (): CoreConfigValues => {
    const env = parseCoreEnv(process.env);
    return {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      apiPrefix: env.API_PREFIX,
    };
  },
);
