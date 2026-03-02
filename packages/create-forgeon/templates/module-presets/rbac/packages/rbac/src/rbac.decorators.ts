import { SetMetadata } from '@nestjs/common';
import { RBAC_PERMISSIONS_KEY, RBAC_ROLES_KEY } from './rbac.constants';
import { Permission, Role } from './rbac.types';

export function Roles(...roles: Role[]) {
  return SetMetadata(RBAC_ROLES_KEY, roles);
}

export function Permissions(...permissions: Permission[]) {
  return SetMetadata(RBAC_PERMISSIONS_KEY, permissions);
}
