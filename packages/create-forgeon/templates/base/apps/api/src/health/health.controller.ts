import { Controller, Get, Optional, Query } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EchoQueryDto } from '../common/dto/echo-query.dto';

@Controller('health')
export class HealthController {
  constructor(@Optional() private readonly i18n?: I18nService) {}

  @Get()
  getHealth(@Query('lang') lang?: string) {
    const locale = this.resolveLocale(lang);
    return {
      status: 'ok',
      message: this.translate('common.ok', lang),
      i18n: this.translate(this.localeNameKey(locale), lang),
    };
  }

  @Get('echo')
  getEcho(@Query() query: EchoQueryDto) {
    return { value: query.value };
  }

  private translate(key: string, lang?: string): string {
    if (!this.i18n) {
      if (key === 'common.ok') return 'OK';
      if (key === 'common.checkApiHealth') return 'Check API health';
      if (key === 'common.language') return 'Language';
      if (key === 'common.languages.english') return 'English';
      if (key === 'common.languages.ukrainian') return 'Ukrainian';
      return key;
    }

    const value = this.i18n.t(key, { lang, defaultValue: key });
    return typeof value === 'string' ? value : key;
  }

  private resolveLocale(lang?: string): 'en' | 'uk' {
    const normalized = (lang ?? '').toLowerCase();
    if (normalized.startsWith('uk')) {
      return 'uk';
    }
    return 'en';
  }

  private localeNameKey(locale: 'en' | 'uk'): string {
    return locale === 'uk' ? 'common.languages.ukrainian' : 'common.languages.english';
  }
}
