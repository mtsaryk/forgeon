import 'reflect-metadata';
import {
  CoreConfigService,
  CoreExceptionFilter,
  createValidationPipe,
} from '@forgeon/core';
import { ForgeonHttpLoggingInterceptor, ForgeonLoggerService } from '@forgeon/logger';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const coreConfigService = app.get(CoreConfigService);
  app.useLogger(app.get(ForgeonLoggerService));
  app.useGlobalInterceptors(app.get(ForgeonHttpLoggingInterceptor));

  app.setGlobalPrefix(coreConfigService.apiPrefix);
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(app.get(CoreExceptionFilter));

  await app.listen(coreConfigService.port);
}

bootstrap();
