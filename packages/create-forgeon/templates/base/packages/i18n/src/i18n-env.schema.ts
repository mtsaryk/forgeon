import { z } from 'zod';

export const i18nEnvSchema = z
  .object({
    I18N_DEFAULT_LANG: z.string().trim().min(1).default('en'),
    I18N_FALLBACK_LANG: z.string().trim().min(1).default('en'),
  })
  .passthrough();

export type I18nEnv = z.infer<typeof i18nEnvSchema>;

export function parseI18nEnv(input: Record<string, unknown>): I18nEnv {
  return i18nEnvSchema.parse(input);
}
