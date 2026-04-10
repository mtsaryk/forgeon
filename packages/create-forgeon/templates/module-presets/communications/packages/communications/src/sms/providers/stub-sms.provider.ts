import { Injectable, Logger } from '@nestjs/common';
import type { SmsProvider, SmsProviderSendInput, SmsProviderSendResult } from '../sms-provider.port';

@Injectable()
export class StubSmsProvider implements SmsProvider {
  private readonly logger = new Logger(StubSmsProvider.name);
  readonly providerId = 'stub';

  async send(input: SmsProviderSendInput): Promise<SmsProviderSendResult> {
    this.logger.warn(`communications.sms.stub phone=${input.phone} length=${input.text.length}`);
    return {
      status: 'stub',
      messageId: null,
    };
  }
}
