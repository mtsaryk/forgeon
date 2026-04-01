import type { JsonObject, UserProfileDto, UserRecordDto, UserSettingsDto } from '@forgeon/accounts-contracts';

export type UserRecord = {
  id: string;
  email: string | null;
  status: string;
  data: JsonObject | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  profile: {
    name: string | null;
    avatar: string | null;
    data: JsonObject | null;
  } | null;
  settings: {
    theme: string | null;
    locale: string | null;
    data: JsonObject | null;
  } | null;
};

export function normalizeObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

export function mergeObjects(baseValue: unknown, patchValue: unknown): JsonObject | null {
  const base = normalizeObject(baseValue) ?? {};
  const patch = normalizeObject(patchValue) ?? {};
  const merged = { ...base, ...patch };
  return Object.keys(merged).length > 0 ? merged : null;
}

export function toPrismaJsonInput(value: JsonObject | null) {
  return (value ?? undefined) as never;
}

export function mapUserRecord(source: {
  id: string;
  status: string;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  profile?: {
    name: string | null;
    avatar: string | null;
    data: unknown;
  } | null;
  settings?: {
    theme: string | null;
    locale: string | null;
    data: unknown;
  } | null;
  authIdentities?: Array<{ providerId: string }>;
}): UserRecord {
  return {
    id: source.id,
    email: source.authIdentities?.[0]?.providerId ?? null,
    status: source.status,
    data: normalizeObject(source.data),
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    deletedAt: source.deletedAt,
    profile: source.profile
      ? {
          name: source.profile.name,
          avatar: source.profile.avatar,
          data: normalizeObject(source.profile.data),
        }
      : null,
    settings: source.settings
      ? {
          theme: source.settings.theme,
          locale: source.settings.locale,
          data: normalizeObject(source.settings.data),
        }
      : null,
  };
}

export function toProfileDto(record: UserRecord['profile']): UserProfileDto {
  return {
    name: record?.name ?? null,
    avatar: record?.avatar ?? null,
    data: record?.data ?? null,
  };
}

export function toSettingsDto(record: UserRecord['settings']): UserSettingsDto {
  return {
    theme: record?.theme ?? null,
    locale: record?.locale ?? null,
    data: record?.data ?? null,
  };
}

export function toUserRecordDto(record: UserRecord): UserRecordDto {
  return {
    id: record.id,
    email: record.email,
    status: record.status,
    data: record.data,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt?.toISOString() ?? null,
    profile: toProfileDto(record.profile),
    settings: toSettingsDto(record.settings),
  };
}
