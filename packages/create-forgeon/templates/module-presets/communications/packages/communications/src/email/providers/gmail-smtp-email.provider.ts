import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { CommunicationsConfigService } from '../../communications-config.service';
import type { EmailProvider, EmailProviderSendInput, EmailProviderSendResult } from '../email-provider.port';

const EMAIL_ERROR_CODES = {
  providerNotConfigured: 'COMMUNICATIONS_EMAIL_PROVIDER_NOT_CONFIGURED',
} as const;

@Injectable()
export class GmailSmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger(GmailSmtpEmailProvider.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: CommunicationsConfigService) {}

  get providerId(): string {
    return this.configService.emailProvider;
  }

  async send(input: EmailProviderSendInput): Promise<EmailProviderSendResult> {
    if (!this.configService.emailProviderReady) {
      throw new ServiceUnavailableException({
        message: 'Email provider is not configured',
        details: {
          code: EMAIL_ERROR_CODES.providerNotConfigured,
          provider: this.providerId,
        },
      });
    }

    const response = await this.getTransporter().sendMail({
      from: this.configService.emailFrom,
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo ?? this.configService.emailReplyTo ?? undefined,
    });

    this.logger.log(`email.sent provider=${this.providerId} to=${input.to} messageId=${response.messageId ?? 'n/a'}`);

    return {
      status: 'sent',
      messageId: response.messageId ?? null,
    };
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.configService.emailSmtpHost,
        port: this.configService.emailSmtpPort,
        secure: this.configService.emailSmtpSecure,
        auth: {
          user: this.configService.emailSmtpUser,
          pass: this.configService.emailSmtpPass,
        },
      });
    }

    return this.transporter;
  }
}
