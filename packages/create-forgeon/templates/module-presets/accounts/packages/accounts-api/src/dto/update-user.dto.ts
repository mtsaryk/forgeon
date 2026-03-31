import type { UpdateUserRequest } from '@forgeon/accounts-contracts';
import { IsObject, IsOptional } from 'class-validator';

export class UpdateUserDto implements UpdateUserRequest {
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
