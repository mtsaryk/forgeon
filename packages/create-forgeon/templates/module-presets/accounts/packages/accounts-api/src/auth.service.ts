import { Injectable } from '@nestjs/common';
import type { RegisterRequest } from '@forgeon/accounts-contracts';
import { AuthCoreService } from './auth-core.service';

@Injectable()
export class AuthService {
  constructor(private readonly authCoreService: AuthCoreService) {}

  register(input: RegisterRequest) {
    return this.authCoreService.registerWithPassword(input);
  }

  login(input: { email: string; password: string }) {
    return this.authCoreService.loginWithPassword(input.email, input.password);
  }

  refresh(input: { refreshToken: string }) {
    return this.authCoreService.refreshTokens(input.refreshToken);
  }

  logout(userId: string, refreshToken: string) {
    return this.authCoreService.logout(userId, refreshToken);
  }

  changePassword(userId: string, newPassword: string) {
    return this.authCoreService.changePassword(userId, newPassword);
  }

  requestPasswordReset(email: string) {
    return this.authCoreService.requestPasswordReset(email);
  }

  resetPassword(token: string, newPassword: string) {
    return this.authCoreService.resetPassword(token, newPassword);
  }

  verifyEmail(token: string) {
    return this.authCoreService.verifyEmail(token);
  }

  me(userId: string) {
    return this.authCoreService.me(userId);
  }

  getProbeStatus() {
    return this.authCoreService.getProbeStatus();
  }
}
