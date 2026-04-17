export const AUTH_PENDING_OPERATION_TYPES = {
  emailVerification: 'email_verification',
  passwordReset: 'password_reset',
  passwordChange: 'password_change',
  emailChange: 'email_change',
} as const;

export type AuthPendingOperationType =
  (typeof AUTH_PENDING_OPERATION_TYPES)[keyof typeof AUTH_PENDING_OPERATION_TYPES];
