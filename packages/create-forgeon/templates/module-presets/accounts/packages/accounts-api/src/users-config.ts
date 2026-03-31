export interface UsersModuleOptions {
  user?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export const USERS_MODULE_OPTIONS = 'FORGEON_USERS_MODULE_OPTIONS';

export class UsersModule {
  static register(options: UsersModuleOptions = {}): UsersModuleOptions {
    return options;
  }
}
