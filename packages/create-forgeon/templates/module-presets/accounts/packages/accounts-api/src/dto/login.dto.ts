import type { LoginRequest } from '@forgeon/accounts-contracts';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto implements LoginRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
