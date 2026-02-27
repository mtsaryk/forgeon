import type { AuthUser } from '@forgeon/auth-contracts';

export interface AuthJwtPayload extends AuthUser {
  iat?: number;
  exp?: number;
}
