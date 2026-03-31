import { Prisma } from '@prisma/client';
import {
  type AccountsPersistencePort,
  type CreatePasswordAccountInput,
  type PasswordAccountRecord,
  type RefreshTokenRecord,
} from '@forgeon/accounts-api';
import { PrismaService } from '@forgeon/db-prisma';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class PrismaAccountsPersistenceStore implements AccountsPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async createPasswordAccount(input: CreatePasswordAccountInput): Promise<PasswordAccountRecord> {
    const userId = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          status: input.status,
          data: this.toNullableJson(input.userData),
          profile: {
            create: {
              name: input.profile.name,
              avatar: input.profile.avatar,
              data: this.toNullableJson(input.profile.data),
            },
          },
          settings: {
            create: {
              theme: input.settings.theme,
              locale: input.settings.locale,
              data: this.toNullableJson(input.settings.data),
            },
          },
        },
        select: { id: true },
      });

      await tx.authIdentity.create({
        data: {
          userId: user.id,
          provider: 'email',
          providerId: input.email,
        },
      });

      await tx.authCredential.create({
        data: {
          userId: user.id,
          passwordHash: input.passwordHash,
        },
      });

      return user.id;
    });

    const account = await this.findAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException('Account could not be created');
    }

    return account;
  }

  async findPasswordAccountByEmail(email: string): Promise<PasswordAccountRecord | null> {
    const identity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerId: {
          provider: 'email',
          providerId: email,
        },
      },
      include: {
        user: {
          include: {
            profile: true,
            settings: true,
            authCredential: true,
            authIdentities: {
              where: { provider: 'email' },
              select: { provider: true, providerId: true },
              take: 1,
            },
          },
        },
      },
    });

    return identity?.user ? this.mapPasswordAccount(identity.user) : null;
  }

  async findAccountByUserId(userId: string): Promise<PasswordAccountRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        settings: true,
        authCredential: true,
        authIdentities: {
          where: { provider: 'email' },
          select: { provider: true, providerId: true },
          take: 1,
        },
      },
    });

    return user ? this.mapPasswordAccount(user) : null;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.authCredential.upsert({
      where: { userId },
      create: { userId, passwordHash },
      update: { passwordHash },
    });
  }

  async createRefreshToken(input: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.authRefreshToken.create({
      data: input,
    });
  }

  async findRefreshTokenById(id: string): Promise<RefreshTokenRecord | null> {
    const token = await this.prisma.authRefreshToken.findUnique({
      where: { id },
    });

    if (!token) {
      return null;
    }

    return {
      id: token.id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      revokedAt: token.revokedAt,
      createdAt: token.createdAt,
    };
  }

  async revokeRefreshToken(id: string, revokedAt: Date): Promise<void> {
    await this.prisma.authRefreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt },
    });
  }

  async revokeRefreshTokensForUser(userId: string, revokedAt: Date): Promise<void> {
    await this.prisma.authRefreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });
  }

  async findUserById(userId: string) {
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

    return user ? this.mapUser(user) : null;
  }

  async updateUser(input: { userId: string; data: Record<string, unknown> | null }) {
    const user = await this.prisma.user.update({
      where: { id: input.userId },
      data: {
        data: this.toNullableJson(input.data),
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

    return this.mapUser(user);
  }

  async updateUserProfile(input: {
    userId: string;
    name: string | null;
    avatar: string | null;
    data: Record<string, unknown> | null;
  }) {
    await this.prisma.userProfile.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        name: input.name,
        avatar: input.avatar,
        data: this.toNullableJson(input.data),
      },
      update: {
        name: input.name,
        avatar: input.avatar,
        data: this.toNullableJson(input.data),
      },
    });

    const user = await this.findUserById(input.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateUserSettings(input: {
    userId: string;
    theme: string | null;
    locale: string | null;
    data: Record<string, unknown> | null;
  }) {
    await this.prisma.userSettings.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        theme: input.theme,
        locale: input.locale,
        data: this.toNullableJson(input.data),
      },
      update: {
        theme: input.theme,
        locale: input.locale,
        data: this.toNullableJson(input.data),
      },
    });

    const user = await this.findUserById(input.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async softDeleteUser(userId: string, deletedAt: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'deleted',
        deletedAt,
      },
    });
  }

  private mapPasswordAccount(user: {
    id: string;
    status: string;
    data: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    profile: { name: string | null; avatar: string | null; data: Prisma.JsonValue | null } | null;
    settings: { theme: string | null; locale: string | null; data: Prisma.JsonValue | null } | null;
    authCredential: { passwordHash: string } | null;
    authIdentities: Array<{ provider?: string; providerId: string }>;
  }): PasswordAccountRecord {
    const emailIdentity = user.authIdentities[0];
    return {
      ...this.mapUser(user),
      provider: 'email',
      providerId: emailIdentity?.providerId ?? '',
      passwordHash: user.authCredential?.passwordHash ?? null,
    };
  }

  private mapUser(user: {
    id: string;
    status: string;
    data: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    profile: { name: string | null; avatar: string | null; data: Prisma.JsonValue | null } | null;
    settings: { theme: string | null; locale: string | null; data: Prisma.JsonValue | null } | null;
    authIdentities: Array<{ providerId: string }>;
  }) {
    return {
      id: user.id,
      email: user.authIdentities[0]?.providerId ?? null,
      status: user.status,
      data: this.fromJson(user.data),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      profile: user.profile
        ? {
            name: user.profile.name,
            avatar: user.profile.avatar,
            data: this.fromJson(user.profile.data),
          }
        : null,
      settings: user.settings
        ? {
            theme: user.settings.theme,
            locale: user.settings.locale,
            data: this.fromJson(user.settings.data),
          }
        : null,
    };
  }

  private toNullableJson(value: Record<string, unknown> | null) {
    return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
  }

  private fromJson(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }
}
