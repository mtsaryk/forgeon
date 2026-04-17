import { Injectable } from '@nestjs/common';
import type {
  ChangePasswordRequest,
  ChangePasswordResult,
  PendingVerificationResponse,
  RegisterRequest,
  RequestChangeEmailRequest,
  VerifyEmailResult,
} from '@forgeon/accounts-contracts';
import {
  AUTH_PENDING_OPERATION_TYPES,
  AuthCoreService,
  AuthPasswordService,
} from '@forgeon/accounts-api';
import { CommunicationsService } from '@forgeon/communications';

@Injectable()
export class AuthCommunicationsService {
  constructor(
    private readonly authCoreService: AuthCoreService,
    private readonly authPasswordService: AuthPasswordService,
    private readonly communicationsService: CommunicationsService,
  ) {}

  async registerWithPendingVerification(input: RegisterRequest): Promise<PendingVerificationResponse> {
    const account = await this.authCoreService.createPasswordAccount(input, {
      status: 'pending_verification',
      emailVerifiedAt: null,
    });
    const operation = await this.authCoreService.issuePendingOperation({
      userId: account.id,
      type: AUTH_PENDING_OPERATION_TYPES.emailVerification,
    });

    await this.communicationsService.send({
      kind: 'email_verification_code',
      channels: ['email'],
      recipient: { email: account.providerId },
      payload: {
        NAME: account.profile?.name ?? 'there',
        TOKEN: operation.token,
      },
      locale: account.settings?.locale ?? undefined,
      metadata: {
        USER_ID: account.id,
        SOURCE: 'accounts-communications.register',
      },
    });

    return {
      status: 'pending_verification',
      message: 'Verification email sent',
    };
  }

  async verifyEmail(token: string): Promise<VerifyEmailResult> {
    const operation = await this.authCoreService.readPendingOperation(
      token,
      AUTH_PENDING_OPERATION_TYPES.emailVerification,
    );
    const account = await this.authCoreService.markEmailVerified(operation.userId);
    await this.authCoreService.consumePendingOperation(operation.id);
    await this.sendWelcomeEmailPlaceholder(account.providerId);
    return this.authCoreService.issueSessionForAccount(account);
  }

  async requestPasswordReset(email: string) {
    const account = await this.authCoreService.findPasswordAccountByEmail(email);
    if (account) {
      const operation = await this.authCoreService.issuePendingOperation({
        userId: account.id,
        type: AUTH_PENDING_OPERATION_TYPES.passwordReset,
      });

      await this.communicationsService.send({
        kind: 'password_reset',
        channels: ['email'],
        recipient: { email: account.providerId },
        payload: {
          NAME: account.profile?.name ?? 'there',
          TOKEN: operation.token,
        },
        locale: account.settings?.locale ?? undefined,
        metadata: {
          USER_ID: account.id,
          SOURCE: 'accounts-communications.password-reset',
        },
      });
    }

    return {
      status: 'accepted',
      message: 'If the account exists, a reset email was sent',
    };
  }

  async confirmPasswordReset(token: string, newPassword: string) {
    const operation = await this.authCoreService.readPendingOperation(
      token,
      AUTH_PENDING_OPERATION_TYPES.passwordReset,
    );
    const passwordHash = await this.authPasswordService.hash(newPassword);
    await this.authCoreService.applyPasswordHash(operation.userId, passwordHash);
    await this.authCoreService.consumePendingOperation(operation.id);
    return {
      status: 'completed',
      message: 'Password reset confirmed',
    };
  }

  async startConfirmedChangePassword(
    userId: string,
    input: ChangePasswordRequest,
  ): Promise<ChangePasswordResult> {
    const account = await this.authCoreService.findAccountByUserIdOrThrow(userId);
    const passwordHash = await this.authPasswordService.hash(input.newPassword);
    const operation = await this.authCoreService.issuePendingOperation({
      userId,
      type: AUTH_PENDING_OPERATION_TYPES.passwordChange,
      metadata: {
        passwordHash,
      },
    });

    await this.communicationsService.send({
      kind: 'password_change_confirmation',
      channels: ['email'],
      recipient: { email: account.providerId },
      payload: {
        NAME: account.profile?.name ?? 'there',
        TOKEN: operation.token,
      },
      locale: account.settings?.locale ?? undefined,
      metadata: {
        USER_ID: account.id,
        SOURCE: 'accounts-communications.change-password',
      },
    });

    return {
      status: 'pending_confirmation',
      message: 'Password change confirmation sent',
    };
  }

  async confirmChangePassword(token: string) {
    const operation = await this.authCoreService.readPendingOperation(
      token,
      AUTH_PENDING_OPERATION_TYPES.passwordChange,
    );
    const passwordHash = this.readMetadataString(operation.metadata, 'passwordHash');
    await this.authCoreService.applyPasswordHash(operation.userId, passwordHash);
    await this.authCoreService.consumePendingOperation(operation.id);
    return {
      status: 'completed',
      message: 'Password changed successfully',
    };
  }

  async requestChangeEmail(userId: string, input: RequestChangeEmailRequest) {
    const account = await this.authCoreService.findAccountByUserIdOrThrow(userId);
    const nextEmail = input.email.trim().toLowerCase();
    const operation = await this.authCoreService.issuePendingOperation({
      userId,
      type: AUTH_PENDING_OPERATION_TYPES.emailChange,
      metadata: {
        email: nextEmail,
      },
    });

    await this.communicationsService.send({
      kind: 'email_change_confirmation',
      channels: ['email'],
      recipient: { email: nextEmail },
      payload: {
        NAME: account.profile?.name ?? 'there',
        TOKEN: operation.token,
      },
      locale: account.settings?.locale ?? undefined,
      metadata: {
        USER_ID: account.id,
        SOURCE: 'accounts-communications.change-email',
      },
    });

    return {
      status: 'accepted',
      message: 'Email change confirmation sent',
    };
  }

  async confirmChangeEmail(token: string) {
    const operation = await this.authCoreService.readPendingOperation(
      token,
      AUTH_PENDING_OPERATION_TYPES.emailChange,
    );
    const nextEmail = this.readMetadataString(operation.metadata, 'email');
    await this.authCoreService.updatePrimaryEmail(operation.userId, nextEmail);
    await this.authCoreService.consumePendingOperation(operation.id);
    return {
      status: 'completed',
      message: 'Email changed successfully',
    };
  }

  async sendWelcomeEmailPlaceholder(_email: string): Promise<void> {
    return;
  }

  async sendAccountNotificationPlaceholder(_email: string): Promise<void> {
    return;
  }

  private readMetadataString(metadata: Record<string, unknown> | null, key: string): string {
    const value = metadata?.[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Missing pending operation metadata: ${key}`);
    }
    return value;
  }
}
