import { Injectable } from '@nestjs/common';
import type {
  ChangePasswordRequest,
  ChangePasswordResult,
  RegisterRequest,
  RegisterResult,
} from '@forgeon/accounts-contracts';
import { AuthCoreService } from './auth-core.service';

export const REGISTER_HANDLER = Symbol('REGISTER_HANDLER');
export const CHANGE_PASSWORD_HANDLER = Symbol('CHANGE_PASSWORD_HANDLER');

export interface RegisterHandler {
  execute(input: RegisterRequest): Promise<RegisterResult>;
}

export interface ChangePasswordHandler {
  execute(userId: string, input: ChangePasswordRequest): Promise<ChangePasswordResult>;
}

@Injectable()
export class DefaultRegisterHandler implements RegisterHandler {
  constructor(private readonly authCoreService: AuthCoreService) {}

  async execute(input: RegisterRequest): Promise<RegisterResult> {
    const account = await this.authCoreService.createPasswordAccount(input, {
      status: 'active',
      emailVerifiedAt: new Date(),
    });
    return this.authCoreService.issueSessionForAccount(account);
  }
}

@Injectable()
export class DefaultChangePasswordHandler implements ChangePasswordHandler {
  constructor(private readonly authCoreService: AuthCoreService) {}

  async execute(userId: string, input: ChangePasswordRequest): Promise<ChangePasswordResult> {
    await this.authCoreService.changePasswordNow(userId, input.newPassword);
    return {
      status: 'completed',
      message: 'Password changed successfully',
    };
  }
}
