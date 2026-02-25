import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoreConfigModule, coreConfig, validateCoreEnv } from '@forgeon/core';
import { ForgeonI18nModule } from '@forgeon/i18n';
import { join } from 'path';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

const i18nDefaultLang = process.env.I18N_DEFAULT_LANG ?? 'en';
const i18nFallbackLang = process.env.I18N_FALLBACK_LANG ?? 'en';
const i18nPath = join(__dirname, '..', '..', '..', 'resources', 'i18n');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [coreConfig],
      validate: validateCoreEnv,
      envFilePath: '.env',
    }),
    CoreConfigModule,
    ForgeonI18nModule.register({
      enabled: true,
      defaultLang: i18nDefaultLang,
      fallbackLang: i18nFallbackLang,
      path: i18nPath,
    }),
    PrismaModule,
  ],
  controllers: [HealthController],
  providers: [AppExceptionFilter],
})
export class AppModule {}

