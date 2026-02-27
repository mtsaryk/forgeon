import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { AppErrorDetails, ValidationErrorDetail } from './error.types';

type HttpLikeResponse = {
  status: (statusCode: number) => {
    json: (body: unknown) => void;
  };
};

@Injectable()
@Catch()
export class CoreExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<HttpLikeResponse>();
    const request = context.getRequest<{ headers?: Record<string, unknown> }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const requestId = this.resolveRequestId(request?.headers);
    const details = this.resolveDetails(payload, status);
    const timestamp = new Date().toISOString();

    response.status(status).json({
      error: {
        code: this.resolveCode(status),
        message: this.resolveMessage(payload, status),
        status,
        ...(details !== undefined ? { details } : {}),
        ...(requestId !== undefined ? { requestId } : {}),
        timestamp,
      },
    });
  }

  private resolveCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      case HttpStatus.METHOD_NOT_ALLOWED:
        return 'METHOD_NOT_ALLOWED';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      case HttpStatus.BAD_GATEWAY:
        return 'BAD_GATEWAY';
      case HttpStatus.GATEWAY_TIMEOUT:
        return 'GATEWAY_TIMEOUT';
      default:
        return 'INTERNAL_ERROR';
    }
  }

  private resolveMessage(payload: unknown, status: number): string {
    if (status === HttpStatus.NOT_FOUND) {
      return 'Resource not found';
    }

    if (typeof payload === 'string') {
      return payload;
    }

    if (typeof payload === 'object' && payload !== null) {
      const obj = payload as { message?: string | string[] };
      if (Array.isArray(obj.message) && obj.message.length > 0) {
        return String(obj.message[0]);
      }
      if (typeof obj.message === 'string' && obj.message.length > 0) {
        return obj.message;
      }
    }

    return status >= 500 ? 'Internal server error' : 'Request failed';
  }

  private resolveDetails(payload: unknown, status: number): AppErrorDetails | undefined {
    if (typeof payload !== 'object' || payload === null) {
      return undefined;
    }

    const obj = payload as { message?: unknown; details?: unknown };

    if (Array.isArray(obj.details)) {
      return obj.details as AppErrorDetails;
    }
    if (obj.details && typeof obj.details === 'object') {
      return obj.details as AppErrorDetails;
    }

    if (status !== HttpStatus.BAD_REQUEST) {
      return undefined;
    }

    const messages = Array.isArray(obj.message)
      ? obj.message.filter((item): item is string => typeof item === 'string')
      : typeof obj.message === 'string'
        ? [obj.message]
        : [];

    if (messages.length === 0) {
      return undefined;
    }

    const details: ValidationErrorDetail[] = messages.map((message) => {
      const field = this.extractField(message);
      return field ? { field, message } : { message };
    });

    return details;
  }

  private resolveRequestId(headers: Record<string, unknown> | undefined): string | undefined {
    if (!headers) {
      return undefined;
    }

    const value = headers['x-request-id'];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim().length > 0) {
      return value[0];
    }
    return undefined;
  }

  private extractField(message: string): string | undefined {
    const match = message.match(/^([A-Za-z0-9_.[\]-]+)\s+/);
    return match?.[1];
  }
}
