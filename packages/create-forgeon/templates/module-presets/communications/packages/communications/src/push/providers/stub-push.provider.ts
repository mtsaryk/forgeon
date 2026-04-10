import { Injectable, Logger } from '@nestjs/common';
import type { PushProvider, PushProviderSendInput, PushProviderSendResult } from '../push-provider.port';

@Injectable()
export class StubPushProvider implements PushProvider {
  private readonly logger = new Logger(StubPushProvider.name);
  readonly providerId = 'stub';

  async send(input: PushProviderSendInput): Promise<PushProviderSendResult> {
    this.logger.warn(`communications.push.stub token=${input.pushToken} length=${input.body.length}`);
    return {
      status: 'stub',
      messageId: null,
    };
  }
}
