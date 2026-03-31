import argon2 from 'argon2';
import { Injectable } from '@nestjs/common';
import { AuthConfigService } from './auth-config.service';

@Injectable()
export class AuthPasswordService {
  constructor(private readonly authConfigService: AuthConfigService) {}

  hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: this.authConfigService.argon2MemoryCost,
      timeCost: this.authConfigService.argon2TimeCost,
      parallelism: this.authConfigService.argon2Parallelism,
    });
  }

  verify(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
