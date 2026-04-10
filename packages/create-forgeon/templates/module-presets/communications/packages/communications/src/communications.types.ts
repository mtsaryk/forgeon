export const communicationChannels = ['email', 'sms', 'push'] as const;

export type CommunicationChannel = (typeof communicationChannels)[number];

export type CommunicationMessageKind =
  | 'email_verification_code'
  | 'password_reset'
  | 'welcome_email'
  | 'login_alert'
  | 'order_status_changed'
  | 'communications_probe'
  | (string & {});

export type CommunicationPayloadValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date;

export interface CommunicationRecipient {
  email?: string;
  phone?: string;
  pushToken?: string;
  userId?: string;
  displayName?: string;
}

export interface CommunicationMessageInput {
  kind: CommunicationMessageKind;
  recipient: CommunicationRecipient;
  channels: CommunicationChannel[];
  payload?: Record<string, CommunicationPayloadValue>;
  locale?: string;
  metadata?: Record<string, CommunicationPayloadValue>;
}

export type CommunicationResultStatus = 'sent' | 'stub' | 'skipped';

export interface CommunicationResult {
  kind: string;
  channel: CommunicationChannel;
  provider: string;
  status: CommunicationResultStatus;
  messageId: string | null;
  recipient: string | null;
  metadata?: Record<string, unknown>;
}

export interface CommunicationProbeResult {
  probeId: string;
  recipient: string;
  result: CommunicationResult;
}
