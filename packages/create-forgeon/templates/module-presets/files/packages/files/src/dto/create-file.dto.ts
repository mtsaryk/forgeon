import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const visibilityValues = ['private', 'members', 'public'] as const;
type FileVisibility = (typeof visibilityValues)[number];

export class CreateFileDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  ownerType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  ownerId?: string;

  @IsOptional()
  @IsString()
  @IsIn(visibilityValues)
  visibility?: FileVisibility;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  createdById?: string;
}
