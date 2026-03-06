import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConnectionOptions } from 'bullmq';
import { QUEUE_CONFIG_NAMESPACE, QueueConfigValues } from './queue-config.loader';

@Injectable()
export class QueueConfigService {
  constructor(private readonly configService: ConfigService) {}

  get enabled(): QueueConfigValues['enabled'] {
    return this.configService.getOrThrow<QueueConfigValues['enabled']>(
      `${QUEUE_CONFIG_NAMESPACE}.enabled`,
    );
  }

  get redisUrl(): QueueConfigValues['redisUrl'] {
    return this.configService.getOrThrow<QueueConfigValues['redisUrl']>(
      `${QUEUE_CONFIG_NAMESPACE}.redisUrl`,
    );
  }

  get prefix(): QueueConfigValues['prefix'] {
    return this.configService.getOrThrow<QueueConfigValues['prefix']>(
      `${QUEUE_CONFIG_NAMESPACE}.prefix`,
    );
  }

  get defaultAttempts(): QueueConfigValues['defaultAttempts'] {
    return this.configService.getOrThrow<QueueConfigValues['defaultAttempts']>(
      `${QUEUE_CONFIG_NAMESPACE}.defaultAttempts`,
    );
  }

  get defaultBackoffMs(): QueueConfigValues['defaultBackoffMs'] {
    return this.configService.getOrThrow<QueueConfigValues['defaultBackoffMs']>(
      `${QUEUE_CONFIG_NAMESPACE}.defaultBackoffMs`,
    );
  }

  get connectionOptions(): ConnectionOptions {
    const parsedUrl = new URL(this.redisUrl);
    const options: ConnectionOptions = {
      host: parsedUrl.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : 6379,
    };

    if (parsedUrl.username) {
      (options as { username?: string }).username = decodeURIComponent(parsedUrl.username);
    }

    if (parsedUrl.password) {
      (options as { password?: string }).password = decodeURIComponent(parsedUrl.password);
    }

    const dbPath = parsedUrl.pathname.replace(/^\//, '');
    if (dbPath.length > 0) {
      const dbValue = Number(dbPath);
      if (Number.isInteger(dbValue) && dbValue >= 0) {
        (options as { db?: number }).db = dbValue;
      }
    }

    if (parsedUrl.protocol === 'rediss:') {
      (options as { tls?: Record<string, never> }).tls = {};
    }

    return options;
  }
}
