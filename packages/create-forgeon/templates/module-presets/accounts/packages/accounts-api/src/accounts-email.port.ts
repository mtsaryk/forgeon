export const ACCOUNTS_EMAIL_PORT = 'FORGEON_ACCOUNTS_EMAIL_PORT';

export interface AccountsEmailPort {
  sendVerificationEmail(input: { email: string; token: string; userId: string }): Promise<void>;
  sendPasswordResetEmail(input: { email: string; token: string; userId: string }): Promise<void>;
  sendWelcomeEmail(input: { email: string; userId: string }): Promise<void>;
}

export class StubAccountsEmailAdapter implements AccountsEmailPort {
  async sendVerificationEmail(): Promise<void> {}
  async sendPasswordResetEmail(): Promise<void> {}
  async sendWelcomeEmail(): Promise<void> {}
}
