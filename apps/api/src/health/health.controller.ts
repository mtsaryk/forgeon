import { BadRequestException, ConflictException, Controller, Get, Post, Query } from '@nestjs/common';
import { PrismaService } from '@forgeon/db-prisma';
import { I18nService } from 'nestjs-i18n';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  getHealth(@Query('lang') lang?: string) {
    return {
      status: 'ok',
      message: this.translate('common.ok', lang),
      i18n: this.translate('common.languages.english', lang),
    };
  }

  @Get('error')
  getErrorProbe(@Query('lang') lang?: string) {
    throw new ConflictException({
      message: this.translate('errors.emailAlreadyExists', lang),
      details: {
        feature: 'core-errors',
        probeId: 'health.error',
        probe: this.translate('common.probes.error', lang),
      },
    });
  }

  @Get('validation')
  getValidationProbe(@Query('value') value?: string, @Query('lang') lang?: string) {
    if (!value || value.trim().length === 0) {
      const translatedMessage = this.translate('validation.required', lang);
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
    const value = this.i18n.t(key, { lang, defaultValue: key });
    return typeof value === 'string' ? value : key;
  }
}
