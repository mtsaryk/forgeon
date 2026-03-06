import { z } from 'zod';

export const filesQuotasEnvSchema = z
  .object({
    FILES_QUOTAS_ENABLED: z.coerce.boolean().default(true),
    FILES_QUOTA_MAX_FILES_PER_OWNER: z.coerce.number().int().positive().default(100),
    FILES_QUOTA_MAX_BYTES_PER_OWNER: z.coerce.number().int().positive().default(104857600),
  })
  .passthrough();

export type FilesQuotasEnv = z.infer<typeof filesQuotasEnvSchema>;

export function parseFilesQuotasEnv(input: Record<string, unknown>): FilesQuotasEnv {
  return filesQuotasEnvSchema.parse(input);
}
