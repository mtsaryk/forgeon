import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
} from './dto';
import { JwtAuthGuard } from './access-token.guard';
import type { AuthAccessTokenPayload } from './auth.types';

type RequestWithUser = { user?: AuthAccessTokenPayload };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Body() body: RefreshDto, @Req() request: RequestWithUser) {
    const user = this.getRequestUser(request);
    await this.authService.logout(user.sub, body.refreshToken);
    return { status: 'ok' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: RequestWithUser) {
    const user = this.getRequestUser(request);
    return this.authService.me(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@Body() body: ChangePasswordDto, @Req() request: RequestWithUser) {
    const user = this.getRequestUser(request);
    return this.authService.changePassword(user.sub, body);
  }

  private getRequestUser(request: RequestWithUser): AuthAccessTokenPayload {
    const user = request.user;
    if (!user?.sub) {
      return {
        sub: 'unknown',
        email: 'unknown@invalid.local',
        type: 'access',
      };
    }
    return user;
  }
}

