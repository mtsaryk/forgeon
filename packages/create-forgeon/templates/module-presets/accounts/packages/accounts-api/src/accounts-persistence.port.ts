import type { IdentityProvider, JsonObject } from '@forgeon/accounts-contracts';
import type { UserRecord } from './users.types';

export const ACCOUNTS_PERSISTENCE_PORT = 'FORGEON_ACCOUNTS_PERSISTENCE_PORT';

export type PasswordAccountRecord = UserRecord & {
  provider: IdentityProvider;
  providerId: string;
  passwordHash: string | null;
};

export type RefreshTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

export interface CreatePasswordAccountInput {
  email: string;
  passwordHash: string;
  status: string;
  userData: JsonObject | null;
  profile: {
    name: string | null;
    avatar: string | null;
    data: JsonObject | null;
  };
  settings: {
    theme: string | null;
    locale: string | null;
    data: JsonObject | null;
  };
}

export interface AccountsPersistencePort {
  createPasswordAccount(input: CreatePasswordAccountInput): Promise<PasswordAccountRecord>;
  findPasswordAccountByEmail(email: string): Promise<PasswordAccountRecord | null>;
  findAccountByUserId(userId: string): Promise<PasswordAccountRecord | null>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  createRefreshToken(input: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findRefreshTokenById(id: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(id: string, revokedAt: Date): Promise<void>;
  revokeRefreshTokensForUser(userId: string, revokedAt: Date): Promise<void>;
  findUserById(userId: string): Promise<UserRecord | null>;
  updateUser(input: { userId: string; data: JsonObject | null }): Promise<UserRecord>;
  updateUserProfile(input: {
    userId: string;
    name: string | null;
    avatar: string | null;
    data: JsonObject | null;
  }): Promise<UserRecord>;
  updateUserSettings(input: {
    userId: string;
    theme: string | null;
    locale: string | null;
    data: JsonObject | null;
  }): Promise<UserRecord>;
  softDeleteUser(userId: string, deletedAt: Date): Promise<void>;
}
