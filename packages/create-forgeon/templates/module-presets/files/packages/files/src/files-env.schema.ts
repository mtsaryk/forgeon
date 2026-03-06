import { z } from 'zod';

const filesEnvSchema = z.object({
  FILES_ENABLED: z
    .string()
    .optional()
    .default('true')
    .transform((value) => value !== 'false'),
  FILES_STORAGE_DRIVER: z.enum(['local', 's3']).optional().default('local'),
  FILES_PUBLIC_BASE_PATH: z.string().optional().default('/files'),
  FILES_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().optional().default(10 * 1024 * 1024),
  FILES_ALLOWED_MIME_PREFIXES: z
    .string()
    .optional()
    .default('image/,application/pdf,text/')
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
});

export type FilesEnvSchema = z.infer<typeof filesEnvSchema>;

export function parseFilesEnv(input: Record<string, string | undefined>): FilesEnvSchema {
  return filesEnvSchema.parse(input);
}

export const filesEnvSchemaZod = filesEnvSchema;
