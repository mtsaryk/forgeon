import { registerAs } from '@nestjs/config';
import { parseAuthEnv } from './auth-env.schema';

export const AUTH_CONFIG_NAMESPACE = 'auth';

export interface AuthConfigValues {
  accessSecret: string;
  accessExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
  bcryptRounds: number;
  demoEmail: string;
  demoPassword: string;
}

export const authConfig = registerAs(AUTH_CONFIG_NAMESPACE, (): AuthConfigValues => {
  const env = parseAuthEnv(process.env);
  return {
    accessSecret: env.JWT_ACCESS_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    bcryptRounds: env.AUTH_BCRYPT_ROUNDS,
    demoEmail: env.AUTH_DEMO_EMAIL.toLowerCase(),
    demoPassword: env.AUTH_DEMO_PASSWORD,
  };
});
