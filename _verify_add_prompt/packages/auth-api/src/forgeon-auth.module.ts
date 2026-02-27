import {
  DynamicModule,
  Module,
  ModuleMetadata,
  Provider,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import {
  AUTH_REFRESH_TOKEN_STORE,
  NoopAuthRefreshTokenStore,
} from './auth-refresh-token.store';
import { AuthConfigModule } from './auth-config.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

export interface ForgeonAuthModuleOptions {
  imports?: ModuleMetadata['imports'];
  refreshTokenStoreProvider?: Provider;
}

@Module({})
export class ForgeonAuthModule {
  static register(options: ForgeonAuthModuleOptions = {}): DynamicModule {
    const refreshTokenStoreProvider =
      options.refreshTokenStoreProvider ??
      ({
        provide: AUTH_REFRESH_TOKEN_STORE,
        useClass: NoopAuthRefreshTokenStore,
      } satisfies Provider);

    return {
      module: ForgeonAuthModule,
      imports: [
        AuthConfigModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({}),
        ...(options.imports ?? []),
      ],
      controllers: [AuthController],
      providers: [AuthService, JwtStrategy, JwtAuthGuard, refreshTokenStoreProvider],
      exports: [AuthConfigModule, AuthService, JwtAuthGuard, AUTH_REFRESH_TOKEN_STORE],
    };
  }
}
