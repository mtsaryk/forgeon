import { Injectable } from '@nestjs/common';

export const AUTH_REFRESH_TOKEN_STORE = Symbol('AUTH_REFRESH_TOKEN_STORE');

export interface AuthRefreshTokenStore {
  readonly kind: string;
  saveRefreshTokenHash(subject: string, hash: string): Promise<void>;
  getRefreshTokenHash(subject: string): Promise<string | null>;
  removeRefreshTokenHash(subject: string): Promise<void>;
}

@Injectable()
export class NoopAuthRefreshTokenStore implements AuthRefreshTokenStore {
  readonly kind = 'none';

  async saveRefreshTokenHash(): Promise<void> {}

  async getRefreshTokenHash(): Promise<string | null> {
    return null;
  }

  async removeRefreshTokenHash(): Promise<void> {}
}
