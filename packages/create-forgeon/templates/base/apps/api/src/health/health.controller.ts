import { ConflictException, Controller, Get, Optional, Post, Query } from '@nestjs/common';
import { PrismaService } from '@forgeon/db-prisma';
import { I18nService } from 'nestjs-i18n';
import { EchoQueryDto } from '../common/dto/echo-query.dto';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly i18n?: I18nService,
  ) {}

  @Get()
  getHealth(@Query('lang') lang?: string) {
    const locale = this.resolveLocale(lang);
    return {
      status: 'ok',
      message: this.translate('common.ok', lang),
      i18n: this.translate(this.localeNameKey(locale), lang),
    };
  }

  @Get('error')
  getErrorProbe() {
    throw new ConflictException({
      message: 'Email already exists',
      details: {
        feature: 'core-errors',
        probe: 'health.error',
      },
    });
  }

  @Get('validation')
  getValidationProbe(@Query() query: EchoQueryDto) {
    return {
      status: 'ok',
      validated: true,
      value: query.value,
    };
  }

  @Post('db')
  async getDbProbe() {
    const token = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const email = `health-probe-${token}@example.local`;
    const user = await this.prisma.user.create({
      data: { email },
      select: { id: true, email: true, createdAt: true },
    });

    return {
      status: 'ok',
      feature: 'db-prisma',
      user,
    };
  }

  private translate(key: string, lang?: string): string {
    if (!this.i18n) {
      if (key === 'common.ok') return 'OK';
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
