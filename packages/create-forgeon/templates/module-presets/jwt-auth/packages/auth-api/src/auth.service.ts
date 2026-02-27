import type {
  AuthErrorCode,
  AuthUser,
  LoginResponse,
  RefreshResponse,
  TokenPair,
} from '@forgeon/auth-contracts';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import {
  AUTH_REFRESH_TOKEN_STORE,
  AuthRefreshTokenStore,
} from './auth-refresh-token.store';
import { AuthConfigService } from './auth-config.service';
import { LoginDto, RefreshDto } from './dto';
import { AuthJwtPayload } from './auth.types';

type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

const AUTH_ERROR_CODES: Record<
  'invalidCredentials' | 'tokenExpired' | 'refreshInvalid',
  AuthErrorCode
> = {
  invalidCredentials: 'AUTH_INVALID_CREDENTIALS',
  tokenExpired: 'AUTH_TOKEN_EXPIRED',
  refreshInvalid: 'AUTH_REFRESH_INVALID',
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: AuthConfigService,
    @Inject(AUTH_REFRESH_TOKEN_STORE)
    private readonly refreshTokenStore: AuthRefreshTokenStore,
  ) {}

  getTokenStoreKind(): string {
    return this.refreshTokenStore.kind;
  }

  async login(input: LoginDto): Promise<LoginResponse> {
    const email = input.email.trim().toLowerCase();
    if (email !== this.configService.demoEmail || input.password !== this.configService.demoPassword) {
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        details: { code: AUTH_ERROR_CODES.invalidCredentials },
      });
    }

    const user: AuthUser = {
      sub: email,
      email,
      roles: ['user'],
    };

    const tokens = await this.issueTokens(user);
    return {
      ...tokens,
      user,
      tokenStore: this.refreshTokenStore.kind,
    };
  }

  async refresh(input: RefreshDto): Promise<RefreshResponse> {
    let payload: AuthJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<AuthJwtPayload>(input.refreshToken, {
        secret: this.configService.refreshSecret,
      });
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

    if (this.refreshTokenStore.kind !== 'none') {
      const storedHash = await this.refreshTokenStore.getRefreshTokenHash(payload.sub);
      if (!storedHash) {
        throw new UnauthorizedException({
          message: 'Refresh token is invalid or expired',
          details: { code: AUTH_ERROR_CODES.refreshInvalid },
        });
      }

      const matched = await compare(input.refreshToken, storedHash);
      if (!matched) {
        throw new UnauthorizedException({
          message: 'Refresh token is invalid or expired',
          details: { code: AUTH_ERROR_CODES.refreshInvalid },
        });
      }
    }

    const user = this.toAuthUser(payload);
    const tokens = await this.issueTokens(user);
    return {
      ...tokens,
      user,
      tokenStore: this.refreshTokenStore.kind,
    };
  }

  async logout(user: AuthJwtPayload): Promise<void> {
    if (this.refreshTokenStore.kind === 'none') {
      return;
    }
    await this.refreshTokenStore.removeRefreshTokenHash(user.sub);
  }

  getProbeStatus() {
    return {
      status: 'ok',
      feature: 'jwt-auth',
      tokenStore: this.refreshTokenStore.kind,
      demoEmail: this.configService.demoEmail,
    };
  }

  private async issueTokens(user: AuthUser): Promise<TokenPair> {
    const payload: AuthJwtPayload = {
      sub: user.sub,
      email: user.email,
      roles: user.roles,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.accessSecret,
        expiresIn: this.toJwtExpiresIn(this.configService.accessExpiresIn),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.refreshSecret,
        expiresIn: this.toJwtExpiresIn(this.configService.refreshExpiresIn),
      }),
    ]);

    if (this.refreshTokenStore.kind !== 'none') {
      const tokenHash = await hash(refreshToken, this.configService.bcryptRounds);
      await this.refreshTokenStore.saveRefreshTokenHash(user.sub, tokenHash);
    }

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      accessTtl: this.configService.accessExpiresIn,
      refreshTtl: this.configService.refreshExpiresIn,
    };
  }

  private toAuthUser(payload: AuthJwtPayload): AuthUser {
    return {
      sub: payload.sub,
      email: payload.email,
      roles: Array.isArray(payload.roles) ? payload.roles : ['user'],
    };
  }

  private toJwtExpiresIn(value: string): JwtExpiresIn {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    }
    return trimmed as JwtExpiresIn;
  }
}
