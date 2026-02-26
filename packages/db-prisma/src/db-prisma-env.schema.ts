import { z } from 'zod';

export const dbPrismaEnvSchema = z
  .object({
    DATABASE_URL: z
      .string()
      .trim()
      .min(1)
      .default('postgresql://postgres:postgres@localhost:5432/app?schema=public'),
  })
  .passthrough();

export type DbPrismaEnv = z.infer<typeof dbPrismaEnvSchema>;

export function parseDbPrismaEnv(input: Record<string, unknown>): DbPrismaEnv {
  return dbPrismaEnvSchema.parse(input);
}
