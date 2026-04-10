import * as crypto from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { CommunicationsConfigService } from './communications-config.service';
import { EmailChannelService } from './email/email-channel.service';
import { PushChannelService } from './push/push-channel.service';
import { SmsChannelService } from './sms/sms-channel.service';
import type {
  CommunicationChannel,
  CommunicationMessageInput,
  CommunicationProbeResult,
  CommunicationResult,
} from './communications.types';

const COMMUNICATIONS_ERROR_CODES = {
  channelsRequired: 'COMMUNICATIONS_CHANNELS_REQUIRED',
  unsupportedChannel: 'COMMUNICATIONS_UNSUPPORTED_CHANNEL',
} as const;

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly configService: CommunicationsConfigService,
    private readonly emailChannelService: EmailChannelService,
    private readonly smsChannelService: SmsChannelService,
    private readonly pushChannelService: PushChannelService,
  ) {}

  async send(input: CommunicationMessageInput): Promise<CommunicationResult[]> {
    if (!Array.isArray(input.channels) || input.channels.length === 0) {
      throw new BadRequestException({
        message: 'Communication request must include at least one channel',
        details: {
          code: COMMUNICATIONS_ERROR_CODES.channelsRequired,
        },
      });
    }

    return Promise.all(input.channels.map((channel) => this.dispatchChannel(channel, input)));
  }

  async sendProbeEmail(email: string): Promise<CommunicationProbeResult> {
    const probeId = crypto.randomUUID();
    const [result] = await this.send({
      kind: 'communications_probe',
      channels: ['email'],
      recipient: { email },
      payload: {
        PROBE_ID: probeId,
        DATE: new Date().toISOString(),
        EMAIL: email,
      },
      metadata: {
        SOURCE: 'communications-health-probe',
      },
    });

    return {
      probeId,
      recipient: email,
      result,
    };
  }

  getProbeStatus() {
    return {
      status: 'ok',
      feature: 'communications',
      templatesRoot: this.configService.templatesRoot,
      email: {
        provider: this.configService.emailProvider,
        ready: this.configService.emailProviderReady,
      },
      sms: {
        provider: this.configService.smsProvider,
      },
      push: {
        provider: this.configService.pushProvider,
      },
      probeRoutes: {
        inspect: 'GET /api/health/communications',
        send: 'POST /api/health/communications',
      },
    };
  }

  private dispatchChannel(channel: CommunicationChannel, input: CommunicationMessageInput): Promise<CommunicationResult> {
    switch (channel) {
      case 'email':
        return this.emailChannelService.send(input);
      case 'sms':
        return this.smsChannelService.send(input);
      case 'push':
        return this.pushChannelService.send(input);
      default:
        throw new BadRequestException({
          message: 'Communication channel is not supported',
          details: {
            code: COMMUNICATIONS_ERROR_CODES.unsupportedChannel,
            channel,
          },
        });
    }
  }
}
