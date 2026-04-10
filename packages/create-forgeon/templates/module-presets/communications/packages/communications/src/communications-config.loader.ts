import * as path from 'node:path';
import { registerAs } from '@nestjs/config';
import { parseCommunicationsEnv } from './communications-env.schema';

export const COMMUNICATIONS_CONFIG_NAMESPACE = 'communications';

export type CommunicationsConfigValues = {
  templatesRoot: string;
  email: {
    provider: 'gmail-smtp';
    from: string;
    replyTo: string | null;
    subjectPrefix: string | null;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
    };
  };
  sms: {
    provider: 'stub';
  };
  push: {
    provider: 'stub';
  };
};

export const communicationsConfig = registerAs(
  COMMUNICATIONS_CONFIG_NAMESPACE,
  (): CommunicationsConfigValues => {
    const env = parseCommunicationsEnv(process.env as unknown as Record<string, unknown>);

    return {
      templatesRoot: path.resolve(process.cwd(), env.COMMUNICATIONS_TEMPLATES_ROOT),
      email: {
        provider: env.COMMUNICATIONS_EMAIL_PROVIDER,
        from: env.COMMUNICATIONS_EMAIL_FROM,
        replyTo: env.COMMUNICATIONS_EMAIL_REPLY_TO || null,
        subjectPrefix: env.COMMUNICATIONS_EMAIL_SUBJECT_PREFIX || null,
        smtp: {
          host: env.COMMUNICATIONS_EMAIL_SMTP_HOST,
          port: env.COMMUNICATIONS_EMAIL_SMTP_PORT,
          secure: env.COMMUNICATIONS_EMAIL_SMTP_SECURE,
          user: env.COMMUNICATIONS_EMAIL_SMTP_USER,
          pass: env.COMMUNICATIONS_EMAIL_SMTP_PASS,
        },
      },
      sms: {
        provider: env.COMMUNICATIONS_SMS_PROVIDER,
      },
      push: {
        provider: env.COMMUNICATIONS_PUSH_PROVIDER,
      },
    };
  },
);
