import crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { CommunicationsService } from '@forgeon/communications';
import type {
  AuthSessionResponse,
  RegisterRequest,
  UserRecordDto,
} from '@forgeon/accounts-contracts';
import { AuthJwtService } from './auth-jwt.service';
import { AuthPasswordService } from './auth-password.service';
import { AuthStore } from './auth.store';
import type { AuthRefreshTokenPayload } from './auth.types';
import { UsersService } from './users.service';
import { toUserRecordDto } from './users.types';

const AUTH_ERROR_CODES = {
  invalidCredentials: 'AUTH_INVALID_CREDENTIALS',
  refreshInvalid: 'AUTH_REFRESH_INVALID',
  tokenExpired: 'AUTH_TOKEN_EXPIRED',
  emailTaken: 'AUTH_EMAIL_TAKEN',
  accountDisabled: 'AUTH_ACCOUNT_DISABLED',
} as const;

@Injectable()
export class AuthCoreService {
  private readonly logger = new Logger(AuthCoreService.name);

  constructor(
    private readonly authStore: AuthStore,
    private readonly communicationsService: CommunicationsService,
    private readonly authJwtService: AuthJwtService,
    private readonly authPasswordService: AuthPasswordService,
    private readonly usersService: UsersService,
  ) {}

  async registerWithPassword(input: RegisterRequest): Promise<AuthSessionResponse> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.authStore.findPasswordAccountByEmail(email);
    if (existing) {
      throw new ConflictException({
        message: 'Email is already registered',
        details: { code: AUTH_ERROR_CODES.emailTaken },
      });
    }

    const passwordHash = await this.authPasswordService.hash(input.password);
    const account = await this.authStore.createPasswordAccount({
      email,
      passwordHash,
      status: 'active',
      userData: this.usersService.resolveUserData(input.user),
      profile: {
        name: this.readNullableString(input.profile, 'name'),
        avatar: this.readNullableString(input.profile, 'avatar'),
        data: this.usersService.resolveProfileData(this.readNestedObject(input.profile, 'data')),
      },
      settings: {
        theme: this.readNullableString(input.settings, 'theme'),
        locale: this.readNullableString(input.settings, 'locale'),
        data: this.usersService.resolveSettingsData(this.readNestedObject(input.settings, 'data')),
      },
    });

    const accountDto = toUserRecordDto(account);
    const verificationToken = this.createStubToken('verify', account.id);
    await Promise.all([
      this.sendCommunicationSafely({
        kind: 'email_verification_code',
        channels: ['email'],
        recipient: { email },
        payload: {
          NAME: accountDto.profile?.name ?? 'there',
          CODE: verificationToken,
        },
        locale: accountDto.settings?.locale ?? undefined,
        metadata: {
          USER_ID: account.id,
          SOURCE: 'accounts.register',
        },
      }),
      this.sendCommunicationSafely({
        kind: 'welcome_email',
        channels: ['email'],
        recipient: { email },
        payload: {
          NAME: accountDto.profile?.name ?? 'there',
        },
        locale: accountDto.settings?.locale ?? undefined,
        metadata: {
          USER_ID: account.id,
          SOURCE: 'accounts.register',
        },
      }),
    ]);

    return this.issueSession(accountDto);
  }

  async loginWithPassword(emailInput: string, password: string): Promise<AuthSessionResponse> {
    const email = emailInput.trim().toLowerCase();
    const account = await this.authStore.findPasswordAccountByEmail(email);
    if (!account?.passwordHash) {
      throw this.invalidCredentialsError();
    }

    this.assertAccountActive(account);

    const matched = await this.authPasswordService.verify(password, account.passwordHash);
    if (!matched) {
      throw this.invalidCredentialsError();
    }

    return this.issueSession(toUserRecordDto(account));
  }

  async refreshTokens(refreshToken: string): Promise<AuthSessionResponse> {
    let payload: AuthRefreshTokenPayload;
    try {
      payload = await this.authJwtService.verifyRefreshToken(refreshToken);
    } catch (error) {
      const code =
        error instanceof Error && error.name === 'TokenExpiredError'
          ? AUTH_ERROR_CODES.tokenExpired
          : AUTH_ERROR_CODES.refreshInvalid;

      throw new UnauthorizedException({
        message: 'Refresh token is invalid or expired',
        details: { code },
      });
    }

    const record = await this.authStore.findRefreshTokenById(payload.jti);
    if (!record || record.revokedAt || record.userId !== payload.sub || record.expiresAt <= new Date()) {
      throw new UnauthorizedException({
        message: 'Refresh token is invalid or expired',
        details: { code: AUTH_ERROR_CODES.refreshInvalid },
      });
    }

    const matched = await this.authPasswordService.verify(refreshToken, record.tokenHash);
    if (!matched) {
      await this.authStore.revokeRefreshToken(record.id, new Date());
      throw new UnauthorizedException({
        message: 'Refresh token is invalid or expired',
        details: { code: AUTH_ERROR_CODES.refreshInvalid },
      });
    }

    const account = await this.authStore.findAccountByUserId(payload.sub);
    if (!account) {
      throw new UnauthorizedException({
        message: 'Refresh token is invalid or expired',
        details: { code: AUTH_ERROR_CODES.refreshInvalid },
      });
    }

    this.assertAccountActive(account);
    await this.authStore.revokeRefreshToken(record.id, new Date());
    return this.issueSession(toUserRecordDto(account));
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const payload = await this.authJwtService.verifyRefreshToken(refreshToken);
    if (payload.sub !== userId) {
      throw new UnauthorizedException({
        message: 'Refresh token does not belong to the current user',
        details: { code: AUTH_ERROR_CODES.refreshInvalid },
      });
    }

    await this.authStore.revokeRefreshToken(payload.jti, new Date());
  }

  async changePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await this.authPasswordService.hash(newPassword);
    await this.authStore.updatePassword(userId, passwordHash);
    await this.authStore.revokeRefreshTokensForUser(userId, new Date());
  }

  async requestPasswordReset(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    const account = await this.authStore.findPasswordAccountByEmail(email);
    if (account) {
      const user = toUserRecordDto(account);
      await this.sendCommunicationSafely({
        kind: 'password_reset',
        channels: ['email'],
        recipient: { email },
        payload: {
          NAME: user.profile?.name ?? 'there',
          TOKEN: this.createStubToken('reset', account.id),
        },
        locale: user.settings?.locale ?? undefined,
        metadata: {
          USER_ID: account.id,
          SOURCE: 'accounts.password-reset',
        },
      });
    }

    return {
      status: 'accepted',
      delivery: 'communications',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    if (token.trim().length < 8) {
      throw new BadRequestException('Reset token is invalid');
    }

    return {
      status: 'accepted',
      delivery: 'stub',
      nextAction: 'accounts-token-flow',
      passwordLength: newPassword.length,
    };
  }

  async verifyEmail(token: string) {
    if (token.trim().length < 8) {
      throw new BadRequestException('Verification token is invalid');
    }

    return {
      status: 'accepted',
      delivery: 'stub',
      nextAction: 'accounts-token-flow',
    };
  }

  async me(userId: string): Promise<{ user: UserRecordDto }> {
    const user = await this.usersService.getByIdOrThrow(userId);
    return { user };
  }

  getProbeStatus() {
    return {
      status: 'ok',
      feature: 'accounts',
      storage: 'db-prisma',
      emailDelivery: 'communications',
      selfServiceRoutes: [
        '/api/users/:id',
        '/api/users/:id/profile',
        '/api/users/:id/settings',
      ],
    };
  }

  private async issueSession(user: UserRecordDto): Promise<AuthSessionResponse> {
    const refreshId = crypto.randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.authJwtService.signAccessToken({
        sub: user.id,
        email: user.email ?? undefined,
        type: 'access',
      }),
      this.authJwtService.signRefreshToken({
        sub: user.id,
        email: user.email ?? undefined,
        jti: refreshId,
        type: 'refresh',
      }),
    ]);

    const tokenHash = await this.authPasswordService.hash(refreshToken);
    await this.authStore.createRefreshToken({
      id: refreshId,
      userId: user.id,
      tokenHash,
      expiresAt: this.toExpiresAt(this.authJwtService.refreshTtl),
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      accessTtl: this.authJwtService.accessTtl,
      refreshTtl: this.authJwtService.refreshTtl,
      user,
    };
  }

  private async sendCommunicationSafely(input: Parameters<CommunicationsService['send']>[0]): Promise<void> {
    try {
      await this.communicationsService.send(input);
    } catch (error) {
      this.logger.warn(
        `accounts.communication_failed kind=${input.kind} channel=${input.channels.join(',')} reason=${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  private assertAccountActive(user: { status: string; deletedAt: Date | null }) {
    if (user.deletedAt || user.status !== 'active') {
      throw new UnauthorizedException({
        message: 'Account is not active',
        details: { code: AUTH_ERROR_CODES.accountDisabled },
      });
    }
  }

  private invalidCredentialsError() {
    return new UnauthorizedException({
      message: 'Invalid credentials',
      details: { code: AUTH_ERROR_CODES.invalidCredentials },
    });
  }

  private createStubToken(kind: string, userId: string): string {
    return `stub-${kind}-${userId}-${Date.now()}`;
  }

  private readNullableString(input: unknown, key: string): string | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null;
    }
    const value = (input as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private readNestedObject(input: unknown, key: string): Record<string, unknown> | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null;
    }
    const value = (input as Record<string, unknown>)[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private toExpiresAt(ttl: string): Date {
    const now = Date.now();
    const match = ttl.trim().match(/^(\d+)([smhd])$/i);
    if (!match) {
      const seconds = Number.parseInt(ttl, 10);
      return new Date(now + (Number.isFinite(seconds) ? seconds : 7 * 24 * 60 * 60) * 1000);
    }

    const amount = Number.parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const multiplier =
      unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
    return new Date(now + amount * multiplier);
  }
}
