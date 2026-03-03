import { Injectable, NestMiddleware } from '@nestjs/common';
import { ForgeonLoggerService } from './forgeon-logger.service';
import { LoggerConfigService } from './logger-config.service';

type HeaderValue = string | string[] | undefined;
type HeadersRecord = Record<string, HeaderValue>;

interface RequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  requestId?: string;
  headers?: HeadersRecord;
}

interface ResponseLike {
  statusCode?: number;
  once?: (event: string, listener: () => void) => void;
}

type NextFunction = () => void;

@Injectable()
export class ForgeonHttpLoggingMiddleware implements NestMiddleware {
  constructor(
    private readonly logger: ForgeonLoggerService,
    private readonly loggerConfig: LoggerConfigService,
  ) {}

  use(request: RequestLike, response: ResponseLike, next: NextFunction): void {
    if (!this.loggerConfig.httpEnabled) {
      next();
      return;
    }

    const method = request.method ?? 'UNKNOWN';
    const path = request.originalUrl ?? request.url ?? '/';
    const ip = request.ip;
    const requestId =
      request.requestId ?? this.readHeader(request.headers, this.loggerConfig.requestIdHeader);
    const startedAt = Date.now();

    if (typeof response.once === 'function') {
      response.once('finish', () => {
        this.logger.logHttpRequest({
          method,
          path,
          statusCode: response.statusCode ?? 200,
          durationMs: Date.now() - startedAt,
          requestId,
          ip,
        });
      });
    }

    next();
  }

  private readHeader(headers: HeadersRecord | undefined, name: string): string | undefined {
    if (!headers) {
      return undefined;
    }

    const value = headers[name.toLowerCase()];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim().length > 0) {
      return value[0];
    }
    return undefined;
  }
}
