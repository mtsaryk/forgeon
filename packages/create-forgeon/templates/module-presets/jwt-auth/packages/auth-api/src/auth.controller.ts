import { AuthUser } from '@forgeon/auth-contracts';
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthJwtPayload } from './auth.types';

type RequestWithUser = { user?: AuthJwtPayload };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  async logout(@Req() request: RequestWithUser) {
    const user = this.getRequestUser(request);
    await this.authService.logout(user);
    return {
      status: 'ok',
      tokenStore: this.authService.getTokenStoreKind(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: RequestWithUser) {
    const user = this.getRequestUser(request);
    return {
      user: this.toAuthUser(user),
      tokenStore: this.authService.getTokenStoreKind(),
    };
  }

  private getRequestUser(request: RequestWithUser): AuthJwtPayload {
    const user = request.user;
    if (!user || typeof user.sub !== 'string' || typeof user.email !== 'string') {
      return {
        sub: 'unknown',
        email: 'unknown@invalid.local',
        roles: ['user'],
      };
    }
    return user;
  }

  private toAuthUser(payload: AuthJwtPayload): AuthUser {
    return {
      sub: payload.sub,
      email: payload.email,
      roles: Array.isArray(payload.roles) ? payload.roles : ['user'],
    };
  }
}
