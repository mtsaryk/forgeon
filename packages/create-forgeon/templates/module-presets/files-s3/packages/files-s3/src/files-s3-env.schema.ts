import { z } from 'zod';

const filesS3EnvSchema = z.object({
  FILES_S3_BUCKET: z.string().optional().default('forgeon-files'),
  FILES_S3_REGION: z.string().optional().default('auto'),
  FILES_S3_ENDPOINT: z.string().optional().default('http://localhost:9000'),
  FILES_S3_ACCESS_KEY_ID: z.string().optional().default('forgeon'),
  FILES_S3_SECRET_ACCESS_KEY: z.string().optional().default('forgeon-secret'),
  FILES_S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .default('true')
    .transform((value) => value !== 'false'),
});

export type FilesS3EnvSchema = z.infer<typeof filesS3EnvSchema>;

export function parseFilesS3Env(input: Record<string, string | undefined>): FilesS3EnvSchema {
  return filesS3EnvSchema.parse(input);
}

export const filesS3EnvSchemaZod = filesS3EnvSchema;
