import type { RequestChangeEmailRequest } from '@forgeon/accounts-contracts';
import { IsEmail } from 'class-validator';

export class RequestChangeEmailDto implements RequestChangeEmailRequest {
  @IsEmail()
  email!: string;
}
