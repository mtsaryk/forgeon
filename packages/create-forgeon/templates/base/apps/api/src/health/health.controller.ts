import { BadRequestException, ConflictException, Controller, Get, Query } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

@Controller('health')
export class HealthController {
  constructor(
    private readonly i18n: I18nService,
  ) {}

  @Get()
  getHealth(@Query('lang') lang?: string) {
    return {
      status: 'ok',
      message: this.translate('common.actions.ok', lang),
      i18n: 'en',
    };
  }

  @Get('error')
  getErrorProbe(@Query('lang') lang?: string) {
    throw new ConflictException({
      message: this.translate('errors.http.CONFLICT', lang),
      details: {
        feature: 'core-errors',
        probeId: 'health.error',
        probe: 'Error envelope probe',
      },
    });
  }

  @Get('validation')
  getValidationProbe(@Query('value') value?: string, @Query('lang') lang?: string) {
    if (!value || value.trim().length === 0) {
      const translatedMessage = this.translate('validation.generic.required', lang);
      throw new BadRequestException({
        message: translatedMessage,
        details: [{ field: 'value', message: translatedMessage }],
      });
    }

    return {
      status: 'ok',
      validated: true,
      value,
    };
  }

  private translate(key: string, lang?: string): string {
    const value = this.i18n.t(key, { lang, defaultValue: key });
    return typeof value === 'string' ? value : key;
  }
}
