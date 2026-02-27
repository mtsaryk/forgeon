import { BadRequestException, ConflictException, Controller, Get, Query, Post } from '@nestjs/common';
import { PrismaService } from '@forgeon/db-prisma';
import { AuthService } from '@forgeon/auth-api';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      message: 'OK',
      i18n: 'disabled',
    };
  }

  @Get('error')
  getErrorProbe() {
    throw new ConflictException({
      message: 'Email already exists',
      details: {
        feature: 'core-errors',
        probeId: 'health.error',
        probe: 'Error envelope probe',
      },
    });
  }

  @Get('validation')
  getValidationProbe(@Query('value') value?: string) {
    if (!value || value.trim().length === 0) {
      throw new BadRequestException({
        message: 'Field is required',
        details: [{ field: 'value', message: 'Field is required' }],
      });
    }

    return {
      status: 'ok',
      validated: true,
      value,
    };
  }


  
  @Get('auth')
  getAuthProbe() {
    return this.authService.getProbeStatus();
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


}
