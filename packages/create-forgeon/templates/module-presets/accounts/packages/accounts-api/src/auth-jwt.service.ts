import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import type { AuthAccessClaims, AuthRefreshClaims } from '@forgeon/accounts-contracts';
import { AuthConfigService } from './auth-config.service';
import type { AuthAccessTokenPayload, AuthRefreshTokenPayload } from './auth.types';

type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

@Injectable()
export class AuthJwtService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authConfigService: AuthConfigService,
  ) {}

  signAccessToken(payload: AuthAccessClaims): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.authConfigService.accessSecret,
      expiresIn: this.toJwtExpiresIn(this.authConfigService.accessExpiresIn),
    });
  }

  signRefreshToken(payload: AuthRefreshClaims): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.authConfigService.refreshSecret,
      expiresIn: this.toJwtExpiresIn(this.authConfigService.refreshExpiresIn),
    });
  }

  verifyAccessToken(token: string): Promise<AuthAccessTokenPayload> {
    return this.jwtService.verifyAsync<AuthAccessTokenPayload>(token, {
      secret: this.authConfigService.accessSecret,
    });
  }

  verifyRefreshToken(token: string): Promise<AuthRefreshTokenPayload> {
    return this.jwtService.verifyAsync<AuthRefreshTokenPayload>(token, {
      secret: this.authConfigService.refreshSecret,
    });
  }

  get accessTtl(): string {
    return this.authConfigService.accessExpiresIn;
  }

  get refreshTtl(): string {
    return this.authConfigService.refreshExpiresIn;
  }

  private toJwtExpiresIn(value: string): JwtExpiresIn {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    }
    return trimmed as JwtExpiresIn;
  }
}
