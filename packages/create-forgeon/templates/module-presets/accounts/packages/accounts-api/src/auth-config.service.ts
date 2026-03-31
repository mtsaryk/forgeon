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

  get argon2MemoryCost(): number {
    return this.configService.getOrThrow<number>(`${AUTH_CONFIG_NAMESPACE}.argon2MemoryCost`);
  }

  get argon2TimeCost(): number {
    return this.configService.getOrThrow<number>(`${AUTH_CONFIG_NAMESPACE}.argon2TimeCost`);
  }

  get argon2Parallelism(): number {
    return this.configService.getOrThrow<number>(`${AUTH_CONFIG_NAMESPACE}.argon2Parallelism`);
  }
}
