import { z } from 'zod';

const filesEnvSchema = z.object({
  FILES_ENABLED: z
    .string()
    .optional()
    .default('true')
    .transform((value) => value !== 'false'),
  FILES_STORAGE_DRIVER: z.enum(['local', 's3']).optional().default('local'),
  FILES_PUBLIC_BASE_PATH: z.string().optional().default('/files'),
});

export type FilesEnvSchema = z.infer<typeof filesEnvSchema>;

export function parseFilesEnv(input: Record<string, string | undefined>): FilesEnvSchema {
  return filesEnvSchema.parse(input);
}

export const filesEnvSchemaZod = filesEnvSchema;
