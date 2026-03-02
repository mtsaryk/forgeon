import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RBAC_PERMISSIONS_HEADER,
  RBAC_PERMISSIONS_KEY,
  RBAC_ROLES_HEADER,
  RBAC_ROLES_KEY,
} from './rbac.constants';
import { hasAllPermissions, hasAnyRole } from './rbac.helpers';
import { Permission, RbacPrincipal, Role } from './rbac.types';

type HeaderValue = string | string[] | undefined;

type HttpRequestLike = {
  user?: unknown;
  headers?: Record<string, HeaderValue>;
};

@Injectable()
export class ForgeonRbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<Role[]>(RBAC_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(RBAC_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredRoles.length === 0 && requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<HttpRequestLike>();
    const principal = this.resolvePrincipal(request);

    if (!hasAnyRole(principal, requiredRoles) || !hasAllPermissions(principal, requiredPermissions)) {
      throw new ForbiddenException({
        message: 'Access denied',
        details: {
          feature: 'rbac',
          requiredRoles,
          requiredPermissions,
        },
      });
    }

    return true;
  }

  private resolvePrincipal(request: HttpRequestLike | undefined): RbacPrincipal {
    const user = request?.user;
    if (user && typeof user === 'object') {
      const principal = user as RbacPrincipal;
      if (Array.isArray(principal.roles) || Array.isArray(principal.permissions)) {
        return {
          roles: Array.isArray(principal.roles) ? principal.roles : [],
          permissions: Array.isArray(principal.permissions) ? principal.permissions : [],
        };
      }
    }

    const headers = request?.headers;
    return {
      roles: this.parseHeaderList(headers?.[RBAC_ROLES_HEADER]),
      permissions: this.parseHeaderList(headers?.[RBAC_PERMISSIONS_HEADER]),
    };
  }

  private parseHeaderList(value: HeaderValue): string[] {
    const source = Array.isArray(value) ? value.join(',') : value;
    if (typeof source !== 'string' || source.trim().length === 0) {
      return [];
    }

    return source
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
