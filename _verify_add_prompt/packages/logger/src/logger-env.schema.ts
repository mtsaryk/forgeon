import { z } from 'zod';

const loggerLevelSchema = z.enum(['error', 'warn', 'log', 'debug', 'verbose']);

export const loggerEnvSchema = z
  .object({
    LOGGER_LEVEL: loggerLevelSchema.default('log'),
    LOGGER_HTTP_ENABLED: z.coerce.boolean().default(true),
    LOGGER_REQUEST_ID_HEADER: z.string().trim().min(1).default('x-request-id'),
  })
  .passthrough();

export type LoggerLevel = z.infer<typeof loggerLevelSchema>;
export type LoggerEnv = z.infer<typeof loggerEnvSchema>;

export function parseLoggerEnv(input: Record<string, unknown>): LoggerEnv {
  return loggerEnvSchema.parse(input);
}

