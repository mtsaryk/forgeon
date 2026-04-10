export interface PushProviderSendInput {
  pushToken: string;
  body: string;
}

export interface PushProviderSendResult {
  status: 'stub' | 'sent';
  messageId: string | null;
}

export interface PushProvider {
  readonly providerId: string;
  send(input: PushProviderSendInput): Promise<PushProviderSendResult>;
}
