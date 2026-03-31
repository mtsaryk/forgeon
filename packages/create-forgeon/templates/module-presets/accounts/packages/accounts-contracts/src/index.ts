export const AUTH_API_ROUTES = {
  register: '/api/auth/register',
  login: '/api/auth/login',
  refresh: '/api/auth/refresh',
  logout: '/api/auth/logout',
  me: '/api/auth/me',
  changePassword: '/api/auth/change-password',
  verifyEmail: '/api/auth/verify-email',
  passwordResetRequest: '/api/auth/password-reset/request',
  passwordResetConfirm: '/api/auth/password-reset/confirm',
} as const;

export const USERS_API_ROUTES = {
  item: '/api/users/:id',
  profile: '/api/users/:id/profile',
  settings: '/api/users/:id/settings',
} as const;

export const AUTH_ERROR_CODES = {
  invalidCredentials: 'AUTH_INVALID_CREDENTIALS',
  refreshInvalid: 'AUTH_REFRESH_INVALID',
  tokenExpired: 'AUTH_TOKEN_EXPIRED',
  emailTaken: 'AUTH_EMAIL_TAKEN',
  accountDisabled: 'AUTH_ACCOUNT_DISABLED',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export type IdentityProvider = 'email' | 'google' | 'apple' | 'facebook';
export type JsonObject = Record<string, unknown>;

export interface UserProfileDto {
  name?: string | null;
  avatar?: string | null;
  data?: JsonObject | null;
}

export interface UserSettingsDto {
  theme?: string | null;
  locale?: string | null;
  data?: JsonObject | null;
}

export interface UserRecordDto {
  id: string;
  email?: string | null;
  status: string;
  data?: JsonObject | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  profile: UserProfileDto;
  settings: UserSettingsDto;
}

export interface AuthAccessClaims {
  sub: string;
  email?: string;
  type: 'access';
}

export interface AuthRefreshClaims {
  sub: string;
  email?: string;
  jti: string;
  type: 'refresh';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  user?: JsonObject;
  profile?: UserProfileDto;
  settings?: UserSettingsDto;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword?: string;
  newPassword: string;
}

export interface RequestPasswordResetRequest {
  email: string;
}

export interface ConfirmPasswordResetRequest {
  token: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface UpdateUserRequest {
  data?: JsonObject;
}

export interface UpdateUserProfileRequest extends UserProfileDto {}
export interface UpdateUserSettingsRequest extends UserSettingsDto {}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  accessTtl: string;
  refreshTtl: string;
}

export interface AuthSessionResponse extends TokenPair {
  user: UserRecordDto;
}
