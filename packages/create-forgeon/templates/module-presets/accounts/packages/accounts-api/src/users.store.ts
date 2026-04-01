import { Injectable, NotFoundException } from '@nestjs/common';
import type { JsonObject } from '@forgeon/accounts-contracts';
import { PrismaService } from '@forgeon/db-prisma';
import type { UserRecord } from './users.types';
import { mapUserRecord, toPrismaJsonInput } from './users.types';

@Injectable()
export class UsersStore {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        settings: true,
        authIdentities: {
          where: { provider: 'email' },
          select: { providerId: true },
          take: 1,
        },
      },
    });

    return user ? mapUserRecord(user) : null;
  }

  async updateUser(input: { userId: string; data: JsonObject | null }): Promise<UserRecord> {
    const user = await this.prisma.user.update({
      where: { id: input.userId },
      data: {
        data: toPrismaJsonInput(input.data),
      },
      include: {
        profile: true,
        settings: true,
        authIdentities: {
          where: { provider: 'email' },
          select: { providerId: true },
          take: 1,
        },
      },
    });

    return mapUserRecord(user);
  }

  async updateUserProfile(input: {
    userId: string;
    name: string | null;
    avatar: string | null;
    data: JsonObject | null;
  }): Promise<UserRecord> {
    await this.prisma.userProfile.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        name: input.name,
        avatar: input.avatar,
        data: toPrismaJsonInput(input.data),
      },
      update: {
        name: input.name,
        avatar: input.avatar,
        data: toPrismaJsonInput(input.data),
      },
    });

    const user = await this.findById(input.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateUserSettings(input: {
    userId: string;
    theme: string | null;
    locale: string | null;
    data: JsonObject | null;
  }): Promise<UserRecord> {
    await this.prisma.userSettings.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        theme: input.theme,
        locale: input.locale,
        data: toPrismaJsonInput(input.data),
      },
      update: {
        theme: input.theme,
        locale: input.locale,
        data: toPrismaJsonInput(input.data),
      },
    });

    const user = await this.findById(input.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async softDelete(userId: string, deletedAt: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'deleted',
        deletedAt,
      },
    });
  }
}
