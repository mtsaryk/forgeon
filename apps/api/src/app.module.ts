import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';
import {
  CoreConfigModule,
  CoreErrorsModule,
  coreConfig,
  coreEnvSchema,
  createEnvValidator,
} from '@forgeon/core';
import { ForgeonI18nModule, i18nConfig, i18nEnvSchema } from '@forgeon/i18n';
import { join } from 'path';
import { HealthController } from './health/health.controller';

const i18nPath = join(__dirname, '..', '..', '..', 'resources', 'i18n');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [coreConfig, dbPrismaConfig, i18nConfig],
      validate: createEnvValidator([coreEnvSchema, dbPrismaEnvSchema, i18nEnvSchema]),
      envFilePath: '.env',
    }),
    CoreConfigModule,
    CoreErrorsModule,
    DbPrismaModule,
    ForgeonI18nModule.register({
      path: i18nPath,
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}

