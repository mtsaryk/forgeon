import { Inject, Injectable } from '@nestjs/common';
import type {
  ChangePasswordRequest,
  RegisterRequest,
} from '@forgeon/accounts-contracts';
import { AuthCoreService } from './auth-core.service';
import {
  CHANGE_PASSWORD_HANDLER,
  REGISTER_HANDLER,
  type ChangePasswordHandler,
  type RegisterHandler,
} from './auth.handlers';

@Injectable()
export class AuthService {
  constructor(
    private readonly authCoreService: AuthCoreService,
    @Inject(REGISTER_HANDLER) private readonly registerHandler: RegisterHandler,
    @Inject(CHANGE_PASSWORD_HANDLER) private readonly changePasswordHandler: ChangePasswordHandler,
  ) {}

  register(input: RegisterRequest) {
    return this.registerHandler.execute(input);
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

  changePassword(userId: string, input: ChangePasswordRequest) {
    return this.changePasswordHandler.execute(userId, input);
  }

  me(userId: string) {
    return this.authCoreService.me(userId);
  }

  getProbeStatus() {
    return this.authCoreService.getProbeStatus();
  }
}
