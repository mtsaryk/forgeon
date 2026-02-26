import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LoggerConfigService } from './logger-config.service';

type HeaderValue = string | string[] | undefined;
type HeadersRecord = Record<string, HeaderValue>;

interface RequestLike {
  headers: HeadersRecord;
  requestId?: string;
}

interface ResponseLike {
  setHeader?: (name: string, value: string) => void;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(private readonly loggerConfig: LoggerConfigService) {}

  use(req: RequestLike, res: ResponseLike, next: () => void): void {
    const headerName = this.loggerConfig.requestIdHeader;
    const requestId = this.readHeader(req.headers, headerName) ?? randomUUID();

    req.requestId = requestId;
    req.headers[headerName] = requestId;
    if (typeof res.setHeader === 'function') {
      res.setHeader(headerName, requestId);
    }

    next();
  }

  private readHeader(headers: HeadersRecord | undefined, name: string): string | undefined {
    if (!headers) {
      return undefined;
    }

    const normalized = name.toLowerCase();
    const value = headers[normalized];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }

    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim().length > 0) {
      return value[0];
    }

    return undefined;
  }
}

