import { RefreshRequest } from '@forgeon/auth-contracts';
import { IsString, MinLength } from 'class-validator';

export class RefreshDto implements RefreshRequest {
  @IsString()
  @MinLength(16)
  refreshToken!: string;
}
