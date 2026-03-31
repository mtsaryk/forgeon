import type { ConfirmPasswordResetRequest } from '@forgeon/accounts-contracts';
import { IsString, MinLength } from 'class-validator';

export class ConfirmPasswordResetDto implements ConfirmPasswordResetRequest {
  @IsString()
  @MinLength(8)
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
