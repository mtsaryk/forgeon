import { registerAs } from '@nestjs/config';
import { parseDbPrismaEnv } from './db-prisma-env.schema';

export const DB_PRISMA_CONFIG_NAMESPACE = 'dbPrisma';

export interface DbPrismaConfigValues {
  databaseUrl: string;
}

export const dbPrismaConfig = registerAs(
  DB_PRISMA_CONFIG_NAMESPACE,
  (): DbPrismaConfigValues => {
    const env = parseDbPrismaEnv(process.env);
    return {
      databaseUrl: env.DATABASE_URL,
    };
  },
);
