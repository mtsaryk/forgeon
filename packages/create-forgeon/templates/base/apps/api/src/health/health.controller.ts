import { Controller, Get, Optional, Query } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EchoQueryDto } from '../common/dto/echo-query.dto';

@Controller('health')
export class HealthController {
  constructor(@Optional() private readonly i18n?: I18nService) {}

  @Get()
  getHealth(@Query('lang') lang?: string) {
    return {
      status: 'ok',
      message: this.translate('common.ok', lang),
    };
  }

  @Get('echo')
  getEcho(@Query() query: EchoQueryDto) {
    return { value: query.value };
  }

  private translate(key: string, lang?: string): string {
    if (!this.i18n) {
      if (key === 'common.ok') return 'OK';
      return key;
    }

    const value = this.i18n.t(key, { lang, defaultValue: key });
    return typeof value === 'string' ? value : key;
  }
}
