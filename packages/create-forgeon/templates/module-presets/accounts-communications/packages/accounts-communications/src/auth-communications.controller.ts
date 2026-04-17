import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@forgeon/accounts-api';
import type { AuthAccessTokenPayload } from '@forgeon/accounts-api';
import { AuthCommunicationsService } from './auth-communications.service';
import {
  ConfirmChangeEmailDto,
  ConfirmChangePasswordDto,
  ConfirmPasswordResetDto,
  RequestChangeEmailDto,
  RequestPasswordResetDto,
  VerifyEmailDto,
} from './dto';

type RequestWithUser = { user?: AuthAccessTokenPayload };

@Controller('auth')
export class AuthCommunicationsController {
  constructor(private readonly authCommunicationsService: AuthCommunicationsService) {}

  @Post('verify-email')
  verifyEmail(@Body() body: VerifyEmailDto) {
    return this.authCommunicationsService.verifyEmail(body.token);
  }

  @Post('password-reset/request')
  requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    return this.authCommunicationsService.requestPasswordReset(body.email);
  }

  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() body: ConfirmPasswordResetDto) {
    return this.authCommunicationsService.confirmPasswordReset(body.token, body.newPassword);
  }

  @Post('change-password/confirm')
  confirmChangePassword(@Body() body: ConfirmChangePasswordDto) {
    return this.authCommunicationsService.confirmChangePassword(body.token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-email/request')
  requestChangeEmail(@Body() body: RequestChangeEmailDto, @Req() request: RequestWithUser) {
    const user = this.getRequestUser(request);
    return this.authCommunicationsService.requestChangeEmail(user.sub, body);
  }

  @Post('change-email/confirm')
  confirmChangeEmail(@Body() body: ConfirmChangeEmailDto) {
    return this.authCommunicationsService.confirmChangeEmail(body.token);
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
