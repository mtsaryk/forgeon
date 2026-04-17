import type { ConfirmChangeEmailRequest } from '@forgeon/accounts-contracts';
import { IsString, MinLength } from 'class-validator';

export class ConfirmChangeEmailDto implements ConfirmChangeEmailRequest {
  @IsString()
  @MinLength(8)
  token!: string;
}
