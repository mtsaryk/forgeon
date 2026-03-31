import type { ChangePasswordRequest } from '@forgeon/accounts-contracts';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto implements ChangePasswordRequest {
  @IsOptional()
  @IsString()
  @MinLength(8)
  currentPassword?: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
