import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthAccessTokenPayload } from './auth.types';

type RequestWithUser = {
  params?: Record<string, string>;
  user?: AuthAccessTokenPayload;
};

@Injectable()
export class OwnerAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const id = request.params?.id;

    if (!user?.sub || !id) {
      throw new ForbiddenException('Owner scope could not be resolved');
    }

    if (id === 'me') {
      request.params = {
        ...(request.params ?? {}),
        id: user.sub,
      };
      return true;
    }

    if (id !== user.sub) {
      throw new ForbiddenException('Only the current account is accessible');
    }

    return true;
  }
}
