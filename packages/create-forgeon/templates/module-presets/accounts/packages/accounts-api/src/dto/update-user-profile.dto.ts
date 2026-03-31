import type { UpdateUserProfileRequest } from '@forgeon/accounts-contracts';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateUserProfileDto implements UpdateUserProfileRequest {
  @IsOptional()
  @IsString()
  name?: string | null;

  @IsOptional()
  @IsString()
  avatar?: string | null;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
