import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DB_PRISMA_CONFIG_NAMESPACE } from './db-prisma-config.loader';

@Injectable()
export class DbPrismaConfigService {
  constructor(private readonly configService: ConfigService) {}

  get databaseUrl(): string {
    return this.configService.getOrThrow<string>(`${DB_PRISMA_CONFIG_NAMESPACE}.databaseUrl`);
  }
}
