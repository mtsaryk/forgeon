export interface SmsProviderSendInput {
  phone: string;
  text: string;
}

export interface SmsProviderSendResult {
  status: 'stub' | 'sent';
  messageId: string | null;
}

export interface SmsProvider {
  readonly providerId: string;
  send(input: SmsProviderSendInput): Promise<SmsProviderSendResult>;
}
