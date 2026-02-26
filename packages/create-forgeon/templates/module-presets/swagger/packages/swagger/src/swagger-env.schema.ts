import { z } from 'zod';

export const swaggerEnvSchema = z
  .object({
    SWAGGER_ENABLED: z.coerce.boolean().default(false),
    SWAGGER_PATH: z.string().trim().min(1).default('docs'),
    SWAGGER_TITLE: z.string().trim().min(1).default('Forgeon API'),
    SWAGGER_VERSION: z.string().trim().min(1).default('1.0.0'),
  })
  .passthrough();

export type SwaggerEnv = z.infer<typeof swaggerEnvSchema>;

export function parseSwaggerEnv(input: Record<string, unknown>): SwaggerEnv {
  return swaggerEnvSchema.parse(input);
}

