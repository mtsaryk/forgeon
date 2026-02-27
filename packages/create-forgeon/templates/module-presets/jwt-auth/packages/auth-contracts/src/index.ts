export const AUTH_API_ROUTES = {
  login: '/api/auth/login',
  refresh: '/api/auth/refresh',
  logout: '/api/auth/logout',
  me: '/api/auth/me',
} as const;

export const AUTH_ERROR_CODES = {
  invalidCredentials: 'AUTH_INVALID_CREDENTIALS',
  tokenExpired: 'AUTH_TOKEN_EXPIRED',
  refreshInvalid: 'AUTH_REFRESH_INVALID',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export interface AuthUser {
  sub: string;
  email: string;
  roles: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  accessTtl: string;
  refreshTtl: string;
}

export interface LoginResponse extends TokenPair {
  user: AuthUser;
  tokenStore: string;
}

export interface RefreshResponse extends TokenPair {
  user: AuthUser;
  tokenStore: string;
}
