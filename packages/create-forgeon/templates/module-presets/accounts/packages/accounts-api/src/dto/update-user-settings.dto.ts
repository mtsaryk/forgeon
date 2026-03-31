import type { UpdateUserSettingsRequest } from '@forgeon/accounts-contracts';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateUserSettingsDto implements UpdateUserSettingsRequest {
  @IsOptional()
  @IsString()
  theme?: string | null;

  @IsOptional()
  @IsString()
  locale?: string | null;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
