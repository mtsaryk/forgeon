import crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AuthSessionResponse,
  JsonObject,
  RegisterRequest,
  UserRecordDto,
} from '@forgeon/accounts-contracts';
import { AuthJwtService } from './auth-jwt.service';
import { AuthPasswordService } from './auth-password.service';
import {
  AuthStore,
  type PasswordAccountRecord,
  type PendingOperationRecord,
} from './auth.store';
import type { AuthRefreshTokenPayload } from './auth.types';
import { UsersService } from './users.service';
import { toUserRecordDto } from './users.types';

const AUTH_ERROR_CODES = {
  invalidCredentials: 'AUTH_INVALID_CREDENTIALS',
  refreshInvalid: 'AUTH_REFRESH_INVALID',
  tokenExpired: 'AUTH_TOKEN_EXPIRED',
  emailTaken: 'AUTH_EMAIL_TAKEN',
  accountDisabled: 'AUTH_ACCOUNT_DISABLED',
  pendingOperationInvalid: 'AUTH_PENDING_OPERATION_INVALID',
} as const;

const DEFAULT_PENDING_OPERATION_TTL_MS = 1000 * 60 * 30;

@Injectable()
export class AuthCoreService {
  constructor(
    private readonly authStore: AuthStore,
    private readonly authJwtService: AuthJwtService,
    private readonly authPasswordService: AuthPasswordService,
    private readonly usersService: UsersService,
  ) {}

  async createPasswordAccount(
    input: RegisterRequest,
    options: {
      status: string;
      emailVerifiedAt: Date | null;
    },
  ): Promise<PasswordAccountRecord> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.authStore.findPasswordAccountByEmail(email);
    if (existing) {
      throw new ConflictException({
        message: 'Email is already registered',
        details: { code: AUTH_ERROR_CODES.emailTaken },
      });
    }

    const passwordHash = await this.authPasswordService.hash(input.password);
    return this.authStore.createPasswordAccount({
      email,
      passwordHash,
      status: options.status,
      emailVerifiedAt: options.emailVerifiedAt,
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

    return this.issueSessionForAccount(account);
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

    const account = await this.findAccountByUserIdOrThrow(payload.sub);
    this.assertAccountActive(account);
    await this.authStore.revokeRefreshToken(record.id, new Date());
    return this.issueSessionForAccount(account);
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

  async changePasswordNow(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await this.authPasswordService.hash(newPassword);
    await this.applyPasswordHash(userId, passwordHash);
  }

  async applyPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.authStore.updatePassword(userId, passwordHash);
    await this.authStore.revokeRefreshTokensForUser(userId, new Date());
  }

  async markEmailVerified(userId: string): Promise<PasswordAccountRecord> {
    await this.authStore.markEmailVerified(userId, new Date());
    return this.findAccountByUserIdOrThrow(userId);
  }

  async updatePrimaryEmail(userId: string, emailInput: string): Promise<PasswordAccountRecord> {
    const email = emailInput.trim().toLowerCase();
    const existing = await this.authStore.findPasswordAccountByEmail(email);
    if (existing && existing.id !== userId) {
      throw new ConflictException({
        message: 'Email is already registered',
        details: { code: AUTH_ERROR_CODES.emailTaken },
      });
    }

    await this.authStore.updatePrimaryEmail(userId, email, new Date());
    return this.findAccountByUserIdOrThrow(userId);
  }

  async issuePendingOperation(input: {
    userId: string;
    type: string;
    metadata?: JsonObject | null;
    ttlMs?: number;
  }): Promise<{ token: string; id: string; expiresAt: Date }> {
    const id = crypto.randomUUID();
    const secret = crypto.randomBytes(24).toString('hex');
    const tokenHash = await this.authPasswordService.hash(secret);
    const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_PENDING_OPERATION_TTL_MS));

    await this.authStore.createPendingOperation({
      id,
      userId: input.userId,
      type: input.type,
      tokenHash,
      metadata: input.metadata ?? null,
      expiresAt,
    });

    return {
      id,
      token: `${id}.${secret}`,
      expiresAt,
    };
  }

  async readPendingOperation(token: string, expectedType: string): Promise<PendingOperationRecord> {
    const [id, secret] = token.trim().split('.');
    if (!id || !secret) {
      throw new BadRequestException({
        message: 'Pending operation token is invalid',
        details: { code: AUTH_ERROR_CODES.pendingOperationInvalid },
      });
    }

    const operation = await this.authStore.findPendingOperationById(id);
    if (!operation || operation.type !== expectedType || operation.consumedAt || operation.expiresAt <= new Date()) {
      throw new BadRequestException({
        message: 'Pending operation token is invalid',
        details: { code: AUTH_ERROR_CODES.pendingOperationInvalid },
      });
    }

    const matched = await this.authPasswordService.verify(secret, operation.tokenHash);
    if (!matched) {
      throw new BadRequestException({
        message: 'Pending operation token is invalid',
        details: { code: AUTH_ERROR_CODES.pendingOperationInvalid },
      });
    }

    return operation;
  }

  async consumePendingOperation(operationId: string): Promise<void> {
    await this.authStore.consumePendingOperation(operationId, new Date());
  }

  async findPasswordAccountByEmail(emailInput: string): Promise<PasswordAccountRecord | null> {
    return this.authStore.findPasswordAccountByEmail(emailInput.trim().toLowerCase());
  }

  async findAccountByUserIdOrThrow(userId: string): Promise<PasswordAccountRecord> {
    const account = await this.authStore.findAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException('Account was not found');
    }
    return account;
  }

  async me(userId: string): Promise<{ user: UserRecordDto }> {
    const user = await this.usersService.getByIdOrThrow(userId);
    return { user };
  }

  async issueSessionForAccount(account: PasswordAccountRecord): Promise<AuthSessionResponse> {
    return this.issueSession(toUserRecordDto(account));
  }

  getProbeStatus() {
    return {
      status: 'ok',
      feature: 'accounts',
      storage: 'db-prisma',
      messagingExtension: 'accounts-communications (optional)',
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
    const value = ttl.trim();
    const matched = value.match(/^(\d+)([smhd])$/);
    if (!matched) {
      return new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    }

    const multipliers = {
      s: 1000,
      m: 1000 * 60,
      h: 1000 * 60 * 60,
      d: 1000 * 60 * 60 * 24,
    } as const;
    const amount = Number(matched[1]);
    const unit = matched[2] as keyof typeof multipliers;
    return new Date(Date.now() + amount * multipliers[unit]);
  }
}
