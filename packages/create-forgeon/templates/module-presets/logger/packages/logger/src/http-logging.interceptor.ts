import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
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

@Injectable()
export class ForgeonHttpLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: ForgeonLoggerService,
    private readonly loggerConfig: LoggerConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<'http'>() !== 'http') {
      return next.handle();
    }

    if (!this.loggerConfig.httpEnabled) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<RequestLike>();
    const response = http.getResponse<ResponseLike>();

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
    } else {
      // Fallback for non-standard response mocks.
      try {
        this.logger.logHttpRequest({
          method,
          path,
          statusCode: response.statusCode ?? 200,
          durationMs: Date.now() - startedAt,
          requestId,
          ip,
        });
      } catch {
        // no-op
      }
    }

    return next.handle();
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
