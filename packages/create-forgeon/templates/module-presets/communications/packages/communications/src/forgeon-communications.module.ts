import { DynamicModule, Module, ModuleMetadata } from '@nestjs/common';
import {
  COMMUNICATIONS_EMAIL_PROVIDER,
  COMMUNICATIONS_PUSH_PROVIDER,
  COMMUNICATIONS_SMS_PROVIDER,
} from './communications.constants';
import { CommunicationsConfigModule } from './communications-config.module';
import { CommunicationsProbeController } from './communications.probe.controller';
import { CommunicationsService } from './communications.service';
import { EmailChannelService } from './email/email-channel.service';
import { GmailSmtpEmailProvider } from './email/providers/gmail-smtp-email.provider';
import { PushChannelService } from './push/push-channel.service';
import { StubPushProvider } from './push/providers/stub-push.provider';
import { SmsChannelService } from './sms/sms-channel.service';
import { StubSmsProvider } from './sms/providers/stub-sms.provider';
import { TemplateLoaderService } from './template-loader.service';
import { TemplateRendererService } from './template-renderer.service';

export interface ForgeonCommunicationsModuleOptions {
  imports?: ModuleMetadata['imports'];
}

@Module({})
export class ForgeonCommunicationsModule {
  static register(options: ForgeonCommunicationsModuleOptions = {}): DynamicModule {
    return {
      module: ForgeonCommunicationsModule,
      imports: [CommunicationsConfigModule, ...(options.imports ?? [])],
      controllers: [CommunicationsProbeController],
      providers: [
        TemplateLoaderService,
        TemplateRendererService,
        CommunicationsService,
        EmailChannelService,
        SmsChannelService,
        PushChannelService,
        GmailSmtpEmailProvider,
        StubSmsProvider,
        StubPushProvider,
        {
          provide: COMMUNICATIONS_EMAIL_PROVIDER,
          useExisting: GmailSmtpEmailProvider,
        },
        {
          provide: COMMUNICATIONS_SMS_PROVIDER,
          useExisting: StubSmsProvider,
        },
        {
          provide: COMMUNICATIONS_PUSH_PROVIDER,
          useExisting: StubPushProvider,
        },
      ],
      exports: [
        CommunicationsConfigModule,
        TemplateLoaderService,
        TemplateRendererService,
        CommunicationsService,
        COMMUNICATIONS_EMAIL_PROVIDER,
        COMMUNICATIONS_SMS_PROVIDER,
        COMMUNICATIONS_PUSH_PROVIDER,
      ],
    };
  }
}
