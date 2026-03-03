import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ForgeonHttpLoggingMiddleware } from './http-logging.middleware';
import { ForgeonLoggerService } from './forgeon-logger.service';
import { LoggerConfigModule } from './logger-config.module';
import { RequestIdMiddleware } from './request-id.middleware';

@Module({
  imports: [LoggerConfigModule],
  providers: [RequestIdMiddleware, ForgeonHttpLoggingMiddleware, ForgeonLoggerService],
  exports: [LoggerConfigModule, ForgeonLoggerService],
})
export class ForgeonLoggerModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, ForgeonHttpLoggingMiddleware).forRoutes('*');
  }
}
