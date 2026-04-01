import { Injectable, NotFoundException } from '@nestjs/common';
import type { IdentityProvider, JsonObject } from '@forgeon/accounts-contracts';
import { PrismaService } from '@forgeon/db-prisma';
import type { UserRecord } from './users.types';
import { mapUserRecord, toPrismaJsonInput } from './users.types';

export type PasswordAccountRecord = UserRecord & {
  provider: IdentityProvider;
  providerId: string;
  passwordHash: string | null;
};

export type RefreshTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

export interface CreatePasswordAccountInput {
  email: string;
  passwordHash: string;
  status: string;
  userData: JsonObject | null;
  profile: {
    name: string | null;
    avatar: string | null;
    data: JsonObject | null;
  };
  settings: {
    theme: string | null;
    locale: string | null;
    data: JsonObject | null;
  };
}

@Injectable()
export class AuthStore {
  constructor(private readonly prisma: PrismaService) {}

  async createPasswordAccount(input: CreatePasswordAccountInput): Promise<PasswordAccountRecord> {
    const userId = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          status: input.status,
          data: toPrismaJsonInput(input.userData),
          profile: {
            create: {
              name: input.profile.name,
              avatar: input.profile.avatar,
              data: toPrismaJsonInput(input.profile.data),
            },
          },
          settings: {
            create: {
              theme: input.settings.theme,
              locale: input.settings.locale,
              data: toPrismaJsonInput(input.settings.data),
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

  private mapPasswordAccount(user: {
    id: string;
    status: string;
    data: unknown;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    profile: { name: string | null; avatar: string | null; data: unknown } | null;
    settings: { theme: string | null; locale: string | null; data: unknown } | null;
    authCredential: { passwordHash: string } | null;
    authIdentities: Array<{ provider?: string; providerId: string }>;
  }): PasswordAccountRecord {
    const emailIdentity = user.authIdentities[0];
    return {
      ...mapUserRecord(user),
      provider: 'email',
      providerId: emailIdentity?.providerId ?? '',
      passwordHash: user.authCredential?.passwordHash ?? null,
    };
  }
}
