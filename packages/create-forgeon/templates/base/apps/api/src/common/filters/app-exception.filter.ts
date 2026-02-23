import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Optional,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Request, Response } from 'express';

@Injectable()
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(@Optional() private readonly i18n?: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const code = this.resolveCode(status);
    const message = this.resolveMessage(payload, status, request);
    const details = this.resolveDetails(payload);

    response.status(status).json({
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    });
  }

  private resolveCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'validation_error';
      case HttpStatus.UNAUTHORIZED:
        return 'unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'forbidden';
      case HttpStatus.NOT_FOUND:
        return 'not_found';
      case HttpStatus.CONFLICT:
        return 'conflict';
      default:
        return 'internal_error';
    }
  }

  private resolveMessage(
    payload: unknown,
    status: number,
    request: Request,
  ): string {
    const lang = this.resolveLang(request);

    if (status === HttpStatus.NOT_FOUND) {
      return this.translate('errors.notFound', lang);
    }

    if (typeof payload === 'string') {
      return this.translate(payload, lang);
    }

    if (typeof payload === 'object' && payload !== null) {
      const obj = payload as { message?: string | string[] };
      if (Array.isArray(obj.message) && obj.message.length > 0) {
        return this.translate(obj.message[0], lang);
      }
      if (typeof obj.message === 'string') {
        return this.translate(obj.message, lang);
      }
    }

    return 'Internal server error';
  }

  private resolveDetails(payload: unknown): unknown {
    if (typeof payload !== 'object' || payload === null) {
      return undefined;
    }

    const obj = payload as { message?: string | string[]; error?: string };
    if (Array.isArray(obj.message) && obj.message.length > 1) {
      return obj.message;
    }

    return undefined;
  }

  private resolveLang(request: Request): string | undefined {
    const queryLang = request.query?.lang;
    if (typeof queryLang === 'string' && queryLang.length > 0) {
      return queryLang;
    }

    const header = request.headers['accept-language'];
    if (typeof header === 'string' && header.length > 0) {
      return header.split(',')[0].trim();
    }

    return undefined;
  }

  private translate(keyOrMessage: string, lang?: string): string {
    if (!this.i18n) {
      return keyOrMessage;
    }

    const translated = this.i18n.t(keyOrMessage, {
      lang,
      defaultValue: keyOrMessage,
    });

    return typeof translated === 'string' ? translated : keyOrMessage;
  }
}
