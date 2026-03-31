import type { AuthAccessClaims, AuthRefreshClaims, IdentityProvider } from '@forgeon/accounts-contracts';

export interface AuthAccessTokenPayload extends AuthAccessClaims {
  iat?: number;
  exp?: number;
}

export interface AuthRefreshTokenPayload extends AuthRefreshClaims {
  iat?: number;
  exp?: number;
}

export interface AuthProfile {
  provider: IdentityProvider;
  providerId: string;
  email?: string;
}
