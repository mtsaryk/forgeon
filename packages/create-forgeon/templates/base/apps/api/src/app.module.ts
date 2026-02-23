import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ForgeonI18nModule } from '@forgeon/i18n';
import { join } from 'path';
import appConfig from './config/app.config';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

const i18nEnabled = (process.env.I18N_ENABLED ?? 'true').toLowerCase() !== 'false';
const i18nDefaultLang = process.env.I18N_DEFAULT_LANG ?? 'en';
const i18nFallbackLang = process.env.I18N_FALLBACK_LANG ?? 'en';
const i18nPath = join(__dirname, '..', '..', '..', 'resources', 'i18n');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: '.env',
    }),
    ForgeonI18nModule.register({
      enabled: i18nEnabled,
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

