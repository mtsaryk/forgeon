export interface EmailProviderSendInput {
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
}

export interface EmailProviderSendResult {
  status: 'sent';
  messageId: string | null;
}

export interface EmailProvider {
  readonly providerId: string;
  send(input: EmailProviderSendInput): Promise<EmailProviderSendResult>;
}
