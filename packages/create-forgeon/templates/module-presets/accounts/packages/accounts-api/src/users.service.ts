import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateUserProfileRequest, UpdateUserSettingsRequest, UpdateUserRequest } from '@forgeon/accounts-contracts';
import { USERS_MODULE_OPTIONS, type UsersModuleOptions } from './users-config';
import { UsersStore } from './users.store';
import { mergeObjects, normalizeObject, toUserRecordDto } from './users.types';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersStore: UsersStore,
    @Inject(USERS_MODULE_OPTIONS)
    private readonly usersModuleOptions: UsersModuleOptions,
  ) {}

  async findById(userId: string) {
    const user = await this.usersStore.findById(userId);
    return user ? toUserRecordDto(user) : null;
  }

  async getByIdOrThrow(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(userId: string, input: UpdateUserRequest) {
    const current = await this.usersStore.findById(userId);
    if (!current) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.usersStore.updateUser({
      userId,
      data: mergeObjects(current.data ?? this.usersModuleOptions.user, input.data),
    });
    return toUserRecordDto(updated);
  }

  async updateProfile(userId: string, input: UpdateUserProfileRequest) {
    const current = await this.usersStore.findById(userId);
    if (!current) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.usersStore.updateUserProfile({
      userId,
      name: input.name ?? current.profile?.name ?? null,
      avatar: input.avatar ?? current.profile?.avatar ?? null,
      data: mergeObjects(current.profile?.data ?? this.usersModuleOptions.profile, input.data),
    });
    return toUserRecordDto(updated).profile;
  }

  async updateSettings(userId: string, input: UpdateUserSettingsRequest) {
    const current = await this.usersStore.findById(userId);
    if (!current) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.usersStore.updateUserSettings({
      userId,
      theme: input.theme ?? current.settings?.theme ?? null,
      locale: input.locale ?? current.settings?.locale ?? null,
      data: mergeObjects(current.settings?.data ?? this.usersModuleOptions.settings, input.data),
    });
    return toUserRecordDto(updated).settings;
  }

  async softDelete(userId: string): Promise<void> {
    await this.usersStore.softDelete(userId, new Date());
  }

  resolveUserData(input: unknown) {
    return mergeObjects(this.usersModuleOptions.user, normalizeObject(input));
  }

  resolveProfileData(input: unknown) {
    return mergeObjects(this.usersModuleOptions.profile, normalizeObject(input));
  }

  resolveSettingsData(input: unknown) {
    return mergeObjects(this.usersModuleOptions.settings, normalizeObject(input));
  }
}
