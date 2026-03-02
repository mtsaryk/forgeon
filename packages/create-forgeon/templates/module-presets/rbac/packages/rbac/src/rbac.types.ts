export type Role = string;
export type Permission = string;

export interface RbacPrincipal {
  roles?: Role[];
  permissions?: Permission[];
}
