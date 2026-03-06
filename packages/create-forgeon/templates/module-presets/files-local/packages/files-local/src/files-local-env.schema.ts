import { z } from 'zod';

const filesLocalEnvSchema = z.object({
  FILES_LOCAL_ROOT: z.string().optional().default('storage/uploads'),
});

export type FilesLocalEnvSchema = z.infer<typeof filesLocalEnvSchema>;

export function parseFilesLocalEnv(input: Record<string, string | undefined>): FilesLocalEnvSchema {
  return filesLocalEnvSchema.parse(input);
}

export const filesLocalEnvSchemaZod = filesLocalEnvSchema;
