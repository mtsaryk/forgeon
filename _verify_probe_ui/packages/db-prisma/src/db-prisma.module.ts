import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { dbPrismaConfig } from './db-prisma-config.loader';
import { DbPrismaConfigService } from './db-prisma-config.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  imports: [ConfigModule.forFeature(dbPrismaConfig)],
  providers: [DbPrismaConfigService, PrismaService],
  exports: [DbPrismaConfigService, PrismaService],
})
export class DbPrismaModule {}
