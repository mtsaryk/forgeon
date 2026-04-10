import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { COMMUNICATIONS_EMAIL_PROVIDER } from '../communications.constants';
import { CommunicationsConfigService } from '../communications-config.service';
import { TemplateLoaderService } from '../template-loader.service';
import { TemplateRendererService } from '../template-renderer.service';
import type { CommunicationMessageInput, CommunicationResult } from '../communications.types';
import type { EmailProvider } from './email-provider.port';

const EMAIL_ERROR_CODES = {
  missingRecipient: 'COMMUNICATIONS_EMAIL_RECIPIENT_REQUIRED',
} as const;

@Injectable()
export class EmailChannelService {
  private readonly logger = new Logger(EmailChannelService.name);

  constructor(
    private readonly configService: CommunicationsConfigService,
    private readonly templateLoader: TemplateLoaderService,
    private readonly templateRenderer: TemplateRendererService,
    @Inject(COMMUNICATIONS_EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
  ) {}

  async send(input: CommunicationMessageInput): Promise<CommunicationResult> {
    const recipient = input.recipient.email?.trim();
    if (!recipient) {
      throw new BadRequestException({
        message: 'Email channel requires an email recipient',
        details: {
          code: EMAIL_ERROR_CODES.missingRecipient,
          channel: 'email',
        },
      });
    }

    const templateValues = {
      ...(input.payload ?? {}),
      ...(input.metadata ?? {}),
    };

    const [htmlTemplate, subjectTemplate] = await Promise.all([
      this.templateLoader.loadChannelTemplate('email', input.kind, input.locale),
      this.templateLoader.loadOptionalEmailSubjectTemplate(input.kind, input.locale),
    ]);

    const subject = this.decorateSubject(
      this.templateRenderer.render(subjectTemplate ?? this.humanizeKind(input.kind), templateValues),
    );
    const html = this.templateRenderer.render(htmlTemplate, templateValues);

    const response = await this.emailProvider.send({
      to: recipient,
      subject,
      html,
      replyTo: this.configService.emailReplyTo,
    });

    this.logger.log(`communications.email kind=${input.kind} provider=${this.emailProvider.providerId} to=${recipient}`);

    return {
      kind: input.kind,
      channel: 'email',
      provider: this.emailProvider.providerId,
      status: response.status,
      messageId: response.messageId,
      recipient,
      metadata: {
        locale: input.locale ?? null,
        subject,
      },
    };
  }

  private humanizeKind(kind: string): string {
    return kind
      .split(/[_-]/g)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  private decorateSubject(subject: string): string {
    const prefix = this.configService.emailSubjectPrefix?.trim();
    if (!prefix) {
      return subject;
    }
    return `${prefix} ${subject}`.trim();
  }
}
