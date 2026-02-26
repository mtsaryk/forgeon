import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ForgeonHttpLoggingInterceptor } from './http-logging.interceptor';
import { ForgeonLoggerService } from './forgeon-logger.service';
import { LoggerConfigModule } from './logger-config.module';
import { RequestIdMiddleware } from './request-id.middleware';

@Module({
  imports: [LoggerConfigModule],
  providers: [RequestIdMiddleware, ForgeonLoggerService, ForgeonHttpLoggingInterceptor],
  exports: [LoggerConfigModule, ForgeonLoggerService, ForgeonHttpLoggingInterceptor],
})
export class ForgeonLoggerModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

