import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']);

export const coreEnvSchema = z
  .object({
    NODE_ENV: nodeEnvSchema.default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    API_PREFIX: z.string().trim().min(1).default('api'),
  })
  .passthrough();

export type CoreEnv = z.infer<typeof coreEnvSchema>;
export type EnvSchema = z.ZodType<Record<string, unknown>>;

export function createEnvValidator(schemas: EnvSchema[]) {
  return (input: Record<string, unknown>) => {
    const merged = { ...input };
    for (const schema of schemas) {
      const parsed = schema.parse(merged);
      Object.assign(merged, parsed);
    }
    return merged;
  };
}

export function parseCoreEnv(input: Record<string, unknown>): CoreEnv {
  return coreEnvSchema.parse(input);
}

export const validateCoreEnv = createEnvValidator([coreEnvSchema]);
