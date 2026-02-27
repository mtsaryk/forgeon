import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';
import { LoggerConfigService } from './logger-config.service';
import type { LoggerLevel } from './logger-env.schema';

interface HttpLogEntry {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  requestId?: string;
  ip?: string;
}

function resolveLogLevels(level: LoggerLevel): LogLevel[] {
  switch (level) {
    case 'error':
      return ['error'];
    case 'warn':
      return ['error', 'warn'];
    case 'log':
      return ['error', 'warn', 'log'];
    case 'debug':
      return ['error', 'warn', 'log', 'debug'];
    case 'verbose':
      return ['error', 'warn', 'log', 'debug', 'verbose'];
    default:
      return ['error', 'warn', 'log'];
  }
}

@Injectable()
export class ForgeonLoggerService extends ConsoleLogger {
  constructor(private readonly loggerConfig: LoggerConfigService) {
    super('ForgeonApi');
    this.setLogLevels(resolveLogLevels(this.loggerConfig.level));
  }

  logHttpRequest(entry: HttpLogEntry): void {
    if (!this.loggerConfig.httpEnabled) {
      return;
    }

    this.log(
      JSON.stringify({
        event: 'http.request',
        ...entry,
      }),
    );
  }
}

