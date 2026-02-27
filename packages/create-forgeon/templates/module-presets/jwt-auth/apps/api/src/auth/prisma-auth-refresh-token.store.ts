import {
  AuthRefreshTokenStore,
} from '@forgeon/auth-api';
import { PrismaService } from '@forgeon/db-prisma';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PrismaAuthRefreshTokenStore implements AuthRefreshTokenStore {
  readonly kind = 'prisma';

  constructor(private readonly prisma: PrismaService) {}

  async saveRefreshTokenHash(subject: string, hash: string): Promise<void> {
    await this.prisma.user.upsert({
      where: { email: subject },
      create: { email: subject, refreshTokenHash: hash },
      update: { refreshTokenHash: hash },
      select: { id: true },
    });
  }

  async getRefreshTokenHash(subject: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: subject },
      select: { refreshTokenHash: true },
    });
    return user?.refreshTokenHash ?? null;
  }

  async removeRefreshTokenHash(subject: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { email: subject },
      data: { refreshTokenHash: null },
    });
  }
}
