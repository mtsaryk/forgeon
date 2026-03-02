import { Permission, RbacPrincipal, Role } from './rbac.types';

export function hasRole(principal: RbacPrincipal | null | undefined, role: Role): boolean {
  const roles = principal?.roles ?? [];
  return roles.includes(role);
}

export function hasPermission(
  principal: RbacPrincipal | null | undefined,
  permission: Permission,
): boolean {
  const permissions = principal?.permissions ?? [];
  return permissions.includes(permission);
}

export function hasAnyRole(principal: RbacPrincipal | null | undefined, roles: Role[]): boolean {
  if (roles.length === 0) {
    return true;
  }
  return roles.some((role) => hasRole(principal, role));
}

export function hasAllPermissions(
  principal: RbacPrincipal | null | undefined,
  permissions: Permission[],
): boolean {
  if (permissions.length === 0) {
    return true;
  }
  return permissions.every((permission) => hasPermission(principal, permission));
}
