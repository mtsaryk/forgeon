import {
  DynamicModule,
  Module,
  ModuleMetadata,
  Provider,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DbPrismaModule } from '@forgeon/db-prisma';
import {
  ACCOUNTS_AUTHZ_CLAIMS_RESOLVER,
  NoopAccountsAuthzClaimsResolver,
} from './accounts-rbac.port';
import { AuthConfigModule } from './auth-config.module';
import { AuthController } from './auth.controller';
import { AuthCoreService } from './auth-core.service';
import { AuthJwtService } from './auth-jwt.service';
import { AuthPasswordService } from './auth-password.service';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';
import { JwtAuthGuard } from './access-token.guard';
import { JwtStrategy } from './jwt.strategy';
import { OwnerAccessGuard } from './owner-access.guard';
import { UsersController } from './users.controller';
import { UsersModule, USERS_MODULE_OPTIONS, type UsersModuleOptions } from './users-config';
import { UsersService } from './users.service';
import { UsersStore } from './users.store';

export interface ForgeonAccountsModuleOptions {
  imports?: ModuleMetadata['imports'];
  providers?: Provider[];
  users?: UsersModuleOptions;
}

@Module({})
export class ForgeonAccountsModule {
  static register(options: ForgeonAccountsModuleOptions = {}): DynamicModule {
    return {
      module: ForgeonAccountsModule,
      imports: [
        AuthConfigModule,
        DbPrismaModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({}),
        ...(options.imports ?? []),
      ],
      controllers: [AuthController, UsersController],
      providers: [
        {
          provide: USERS_MODULE_OPTIONS,
          useValue: UsersModule.register(options.users ?? {}),
        },
        {
          provide: ACCOUNTS_AUTHZ_CLAIMS_RESOLVER,
          useClass: NoopAccountsAuthzClaimsResolver,
        },
        AuthStore,
        UsersStore,
        AuthCoreService,
        AuthJwtService,
        AuthPasswordService,
        AuthService,
        UsersService,
        JwtStrategy,
        JwtAuthGuard,
        OwnerAccessGuard,
        ...(options.providers ?? []),
      ],
      exports: [
        AuthConfigModule,
        AuthCoreService,
        AuthJwtService,
        AuthPasswordService,
        AuthService,
        UsersService,
        JwtAuthGuard,
        OwnerAccessGuard,
        ACCOUNTS_AUTHZ_CLAIMS_RESOLVER,
      ],
    };
  }
}
