import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { COMMUNICATIONS_PUSH_PROVIDER } from '../communications.constants';
import { TemplateLoaderService } from '../template-loader.service';
import { TemplateRendererService } from '../template-renderer.service';
import type { CommunicationMessageInput, CommunicationResult } from '../communications.types';
import type { PushProvider } from './push-provider.port';

const PUSH_ERROR_CODES = {
  missingRecipient: 'COMMUNICATIONS_PUSH_RECIPIENT_REQUIRED',
} as const;

@Injectable()
export class PushChannelService {
  private readonly logger = new Logger(PushChannelService.name);

  constructor(
    private readonly templateLoader: TemplateLoaderService,
    private readonly templateRenderer: TemplateRendererService,
    @Inject(COMMUNICATIONS_PUSH_PROVIDER)
    private readonly pushProvider: PushProvider,
  ) {}

  async send(input: CommunicationMessageInput): Promise<CommunicationResult> {
    const recipient = input.recipient.pushToken?.trim();
    if (!recipient) {
      throw new BadRequestException({
        message: 'Push channel requires a push token recipient',
        details: {
          code: PUSH_ERROR_CODES.missingRecipient,
          channel: 'push',
        },
      });
    }

    const template = await this.templateLoader.loadChannelTemplate('push', input.kind, input.locale);
    const body = this.templateRenderer.render(template, {
      ...(input.payload ?? {}),
      ...(input.metadata ?? {}),
    });

    const response = await this.pushProvider.send({ pushToken: recipient, body });
    this.logger.warn(`communications.push kind=${input.kind} provider=${this.pushProvider.providerId}`);

    return {
      kind: input.kind,
      channel: 'push',
      provider: this.pushProvider.providerId,
      status: response.status,
      messageId: response.messageId,
      recipient,
      metadata: {
        locale: input.locale ?? null,
      },
    };
  }
}
