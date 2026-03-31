import type { RequestPasswordResetRequest } from '@forgeon/accounts-contracts';
import { IsEmail } from 'class-validator';

export class RequestPasswordResetDto implements RequestPasswordResetRequest {
  @IsEmail()
  email!: string;
}
