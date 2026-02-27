import 'reflect-metadata';
import {
  CoreConfigService,
  CoreExceptionFilter,
  createValidationPipe,
} from '@forgeon/core';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const coreConfigService = app.get(CoreConfigService);

  app.setGlobalPrefix(coreConfigService.apiPrefix);
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(app.get(CoreExceptionFilter));

  await app.listen(coreConfigService.port);
}

bootstrap();
