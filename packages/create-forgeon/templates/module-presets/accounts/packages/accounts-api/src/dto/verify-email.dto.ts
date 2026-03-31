import type { VerifyEmailRequest } from '@forgeon/accounts-contracts';
import { IsString, MinLength } from 'class-validator';

export class VerifyEmailDto implements VerifyEmailRequest {
  @IsString()
  @MinLength(8)
  token!: string;
}
