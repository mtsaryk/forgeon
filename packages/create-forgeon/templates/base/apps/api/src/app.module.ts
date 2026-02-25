import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { PrismaModule } from './prisma/prisma.module';

const i18nPath = join(__dirname, '..', '..', '..', 'resources', 'i18n');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [coreConfig, i18nConfig],
      validate: createEnvValidator([coreEnvSchema, i18nEnvSchema]),
      envFilePath: '.env',
    }),
    CoreConfigModule,
    CoreErrorsModule,
    ForgeonI18nModule.register({
      path: i18nPath,
    }),
    PrismaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

