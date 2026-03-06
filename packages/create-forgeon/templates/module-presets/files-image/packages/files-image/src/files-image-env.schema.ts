import { z } from 'zod';

export const filesImageEnvSchema = z
  .object({
    FILES_IMAGE_ENABLED: z.coerce.boolean().default(true),
    FILES_IMAGE_STRIP_METADATA: z.coerce.boolean().default(true),
    FILES_IMAGE_MAX_WIDTH: z.coerce.number().int().positive().default(4096),
    FILES_IMAGE_MAX_HEIGHT: z.coerce.number().int().positive().default(4096),
    FILES_IMAGE_MAX_PIXELS: z.coerce.number().int().positive().default(16777216),
    FILES_IMAGE_MAX_FRAMES: z.coerce.number().int().positive().default(1),
    FILES_IMAGE_PROCESS_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    FILES_IMAGE_ALLOWED_MIME_TYPES: z
      .string()
      .default('image/jpeg,image/png,image/webp')
      .transform((value) =>
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      ),
  })
  .passthrough();

export type FilesImageEnv = z.infer<typeof filesImageEnvSchema>;

export function parseFilesImageEnv(input: Record<string, unknown>): FilesImageEnv {
  return filesImageEnvSchema.parse(input);
}
