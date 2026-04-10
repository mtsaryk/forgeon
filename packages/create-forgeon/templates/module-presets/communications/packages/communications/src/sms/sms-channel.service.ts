import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { COMMUNICATIONS_SMS_PROVIDER } from '../communications.constants';
import { TemplateLoaderService } from '../template-loader.service';
import { TemplateRendererService } from '../template-renderer.service';
import type { CommunicationMessageInput, CommunicationResult } from '../communications.types';
import type { SmsProvider } from './sms-provider.port';

const SMS_ERROR_CODES = {
  missingRecipient: 'COMMUNICATIONS_SMS_RECIPIENT_REQUIRED',
} as const;

@Injectable()
export class SmsChannelService {
  private readonly logger = new Logger(SmsChannelService.name);

  constructor(
    private readonly templateLoader: TemplateLoaderService,
    private readonly templateRenderer: TemplateRendererService,
    @Inject(COMMUNICATIONS_SMS_PROVIDER)
    private readonly smsProvider: SmsProvider,
  ) {}

  async send(input: CommunicationMessageInput): Promise<CommunicationResult> {
    const recipient = input.recipient.phone?.trim();
    if (!recipient) {
      throw new BadRequestException({
        message: 'SMS channel requires a phone recipient',
        details: {
          code: SMS_ERROR_CODES.missingRecipient,
          channel: 'sms',
        },
      });
    }

    const template = await this.templateLoader.loadChannelTemplate('sms', input.kind, input.locale);
    const text = this.templateRenderer.render(template, {
      ...(input.payload ?? {}),
      ...(input.metadata ?? {}),
    });

    const response = await this.smsProvider.send({ phone: recipient, text });
    this.logger.warn(`communications.sms kind=${input.kind} provider=${this.smsProvider.providerId} phone=${recipient}`);

    return {
      kind: input.kind,
      channel: 'sms',
      provider: this.smsProvider.providerId,
      status: response.status,
      messageId: response.messageId,
      recipient,
      metadata: {
        locale: input.locale ?? null,
      },
    };
  }
}
