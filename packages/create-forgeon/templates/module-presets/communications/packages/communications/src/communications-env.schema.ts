import { z } from 'zod';

export const communicationsEnvSchema = z
  .object({
    COMMUNICATIONS_TEMPLATES_ROOT: z.string().trim().min(1).default('resources/communications'),
    COMMUNICATIONS_EMAIL_PROVIDER: z.enum(['gmail-smtp']).default('gmail-smtp'),
    COMMUNICATIONS_EMAIL_FROM: z.string().trim().min(1).default('Forgeon <no-reply@example.com>'),
    COMMUNICATIONS_EMAIL_REPLY_TO: z.string().trim().default(''),
    COMMUNICATIONS_EMAIL_SUBJECT_PREFIX: z.string().trim().default('[Forgeon]'),
    COMMUNICATIONS_EMAIL_SMTP_HOST: z.string().trim().min(1).default('smtp.gmail.com'),
    COMMUNICATIONS_EMAIL_SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    COMMUNICATIONS_EMAIL_SMTP_SECURE: z.coerce.boolean().default(false),
    COMMUNICATIONS_EMAIL_SMTP_USER: z.string().trim().default(''),
    COMMUNICATIONS_EMAIL_SMTP_PASS: z.string().trim().default(''),
    COMMUNICATIONS_SMS_PROVIDER: z.enum(['stub']).default('stub'),
    COMMUNICATIONS_PUSH_PROVIDER: z.enum(['stub']).default('stub')
  })
  .passthrough();

export type CommunicationsEnv = z.infer<typeof communicationsEnvSchema>;

export function parseCommunicationsEnv(input: Record<string, unknown>): CommunicationsEnv {
  return communicationsEnvSchema.parse(input);
}
