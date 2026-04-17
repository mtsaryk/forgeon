import { Injectable } from '@nestjs/common';
import type {
  ChangePasswordRequest,
  ChangePasswordResult,
} from '@forgeon/accounts-contracts';
import type { ChangePasswordHandler } from '@forgeon/accounts-api';
import { AuthCommunicationsService } from './auth-communications.service';

@Injectable()
export class ConfirmedChangePasswordHandler implements ChangePasswordHandler {
  constructor(private readonly authCommunicationsService: AuthCommunicationsService) {}

  execute(userId: string, input: ChangePasswordRequest): Promise<ChangePasswordResult> {
    return this.authCommunicationsService.startConfirmedChangePassword(userId, input);
  }
}
