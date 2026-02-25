import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { I18nConfigService } from './i18n-config.service';

@Module({
  imports: [ConfigModule],
  providers: [I18nConfigService],
  exports: [I18nConfigService],
})
export class I18nConfigModule {}
