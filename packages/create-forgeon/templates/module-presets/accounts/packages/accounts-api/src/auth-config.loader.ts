import { registerAs } from '@nestjs/config';
import { parseAuthEnv } from './auth-env.schema';

export const AUTH_CONFIG_NAMESPACE = 'auth';

export interface AuthConfigValues {
  accessSecret: string;
  accessExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
  argon2MemoryCost: number;
  argon2TimeCost: number;
  argon2Parallelism: number;
}

export const authConfig = registerAs(AUTH_CONFIG_NAMESPACE, (): AuthConfigValues => {
  const env = parseAuthEnv(process.env);
  return {
    accessSecret: env.JWT_ACCESS_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    argon2MemoryCost: env.AUTH_ARGON2_MEMORY_COST,
    argon2TimeCost: env.AUTH_ARGON2_TIME_COST,
    argon2Parallelism: env.AUTH_ARGON2_PARALLELISM,
  };
});
