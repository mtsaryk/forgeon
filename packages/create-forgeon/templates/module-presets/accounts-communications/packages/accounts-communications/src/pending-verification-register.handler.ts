import { Injectable } from '@nestjs/common';
import type { RegisterRequest, RegisterResult } from '@forgeon/accounts-contracts';
import type { RegisterHandler } from '@forgeon/accounts-api';
import { AuthCommunicationsService } from './auth-communications.service';

@Injectable()
export class PendingVerificationRegisterHandler implements RegisterHandler {
  constructor(private readonly authCommunicationsService: AuthCommunicationsService) {}

  execute(input: RegisterRequest): Promise<RegisterResult> {
    return this.authCommunicationsService.registerWithPendingVerification(input);
  }
}
