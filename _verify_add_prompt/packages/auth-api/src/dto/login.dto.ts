import type { LoginRequest } from '@forgeon/auth-contracts';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto implements LoginRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
