import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FilesLocalConfigService {
  constructor(private readonly configService: ConfigService) {}

  get rootDir(): string {
    return this.configService.getOrThrow<string>('filesLocal.rootDir');
  }
}
