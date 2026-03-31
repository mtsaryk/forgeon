import type { RegisterRequest } from '@forgeon/accounts-contracts';
import { IsEmail, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto implements RegisterRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsObject()
  user?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  profile?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
