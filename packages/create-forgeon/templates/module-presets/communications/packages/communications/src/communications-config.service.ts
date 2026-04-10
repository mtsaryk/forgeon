import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { COMMUNICATIONS_CONFIG_NAMESPACE } from './communications-config.loader';

@Injectable()
export class CommunicationsConfigService {
  constructor(private readonly configService: ConfigService) {}

  get templatesRoot(): string {
    return this.configService.getOrThrow<string>(`${COMMUNICATIONS_CONFIG_NAMESPACE}.templatesRoot`);
  }

  get emailProvider(): 'gmail-smtp' {
    return this.configService.getOrThrow<'gmail-smtp'>(`${COMMUNICATIONS_CONFIG_NAMESPACE}.email.provider`);
  }

  get emailFrom(): string {
    return this.configService.getOrThrow<string>(`${COMMUNICATIONS_CONFIG_NAMESPACE}.email.from`);
  }

  get emailReplyTo(): string | null {
    return this.configService.get<string | null>(`${COMMUNICATIONS_CONFIG_NAMESPACE}.email.replyTo`) ?? null;
  }

  get emailSubjectPrefix(): string | null {
    return this.configService.get<string | null>(`${COMMUNICATIONS_CONFIG_NAMESPACE}.email.subjectPrefix`) ?? null;
  }

  get emailSmtpHost(): string {
    return this.configService.getOrThrow<string>(`${COMMUNICATIONS_CONFIG_NAMESPACE}.email.smtp.host`);
  }

  get emailSmtpPort(): number {
    return this.configService.getOrThrow<number>(`${COMMUNICATIONS_CONFIG_NAMESPACE}.email.smtp.port`);
  }

  get emailSmtpSecure(): boolean {
    return this.configService.getOrThrow<boolean>(`${COMMUNICATIONS_CONFIG_NAMESPACE}.email.smtp.secure`);
  }

  get emailSmtpUser(): string {
    return this.configService.getOrThrow<string>(`${COMMUNICATIONS_CONFIG_NAMESPACE}.email.smtp.user`);
  }

  get emailSmtpPass(): string {
    return this.configService.getOrThrow<string>(`${COMMUNICATIONS_CONFIG_NAMESPACE}.email.smtp.pass`);
  }

  get smsProvider(): 'stub' {
    return this.configService.getOrThrow<'stub'>(`${COMMUNICATIONS_CONFIG_NAMESPACE}.sms.provider`);
  }

  get pushProvider(): 'stub' {
    return this.configService.getOrThrow<'stub'>(`${COMMUNICATIONS_CONFIG_NAMESPACE}.push.provider`);
  }

  get emailProviderReady(): boolean {
    return this.emailSmtpUser.trim().length > 0 && this.emailSmtpPass.trim().length > 0;
  }
}
