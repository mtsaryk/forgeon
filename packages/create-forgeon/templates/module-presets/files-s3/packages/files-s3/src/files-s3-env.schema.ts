import { z } from 'zod';

const s3ProviderPresetSchema = z.enum(['minio', 'r2', 'aws', 'custom']);

function parseIntFromEnv(defaultValue: number, minValue: number) {
  return z
    .string()
    .optional()
    .default(String(defaultValue))
    .transform((value) => Number.parseInt(value, 10))
    .refine((value) => Number.isInteger(value), 'must be an integer')
    .refine((value) => value >= minValue, `must be >= ${minValue}`);
}

const filesS3EnvSchema = z.object({
  FILES_S3_PROVIDER_PRESET: s3ProviderPresetSchema.optional().default('minio'),
  FILES_S3_BUCKET: z.string().optional().default('forgeon-files'),
  FILES_S3_REGION: z.string().optional(),
  FILES_S3_ENDPOINT: z.string().optional(),
  FILES_S3_ACCESS_KEY_ID: z.string().optional().default('forgeon'),
  FILES_S3_SECRET_ACCESS_KEY: z.string().optional().default('forgeon-secret'),
  FILES_S3_FORCE_PATH_STYLE: z.string().optional(),
  FILES_S3_MAX_ATTEMPTS: parseIntFromEnv(3, 1),
});

export type FilesS3EnvSchema = z.infer<typeof filesS3EnvSchema>;

export function parseFilesS3Env(input: Record<string, string | undefined>): FilesS3EnvSchema {
  return filesS3EnvSchema.parse(input);
}

export const filesS3EnvSchemaZod = filesS3EnvSchema;
