import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AUTH_CONFIG_NAMESPACE } from './auth-config.loader';

@Injectable()
export class AuthConfigService {
  constructor(private readonly configService: ConfigService) {}

  get accessSecret(): string {
    return this.configService.getOrThrow<string>(`${AUTH_CONFIG_NAMESPACE}.accessSecret`);
  }

  get accessExpiresIn(): string {
    return this.configService.getOrThrow<string>(`${AUTH_CONFIG_NAMESPACE}.accessExpiresIn`);
  }

  get refreshSecret(): string {
    return this.configService.getOrThrow<string>(`${AUTH_CONFIG_NAMESPACE}.refreshSecret`);
  }

  get refreshExpiresIn(): string {
    return this.configService.getOrThrow<string>(`${AUTH_CONFIG_NAMESPACE}.refreshExpiresIn`);
  }

  get bcryptRounds(): number {
    return this.configService.getOrThrow<number>(`${AUTH_CONFIG_NAMESPACE}.bcryptRounds`);
  }

  get demoEmail(): string {
    return this.configService.getOrThrow<string>(`${AUTH_CONFIG_NAMESPACE}.demoEmail`);
  }

  get demoPassword(): string {
    return this.configService.getOrThrow<string>(`${AUTH_CONFIG_NAMESPACE}.demoPassword`);
  }
}
