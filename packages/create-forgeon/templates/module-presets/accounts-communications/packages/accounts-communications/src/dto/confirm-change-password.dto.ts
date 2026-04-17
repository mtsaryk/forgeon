import type { ConfirmChangePasswordRequest } from '@forgeon/accounts-contracts';
import { IsString, MinLength } from 'class-validator';

export class ConfirmChangePasswordDto implements ConfirmChangePasswordRequest {
  @IsString()
  @MinLength(8)
  token!: string;
}
