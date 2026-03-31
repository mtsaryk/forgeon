import type { RefreshRequest } from '@forgeon/accounts-contracts';
import { IsString, MinLength } from 'class-validator';

export class RefreshDto implements RefreshRequest {
  @IsString()
  @MinLength(16)
  refreshToken!: string;
}
