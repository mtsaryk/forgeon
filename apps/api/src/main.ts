import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { CoreConfigService } from '@forgeon/core';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const coreConfigService = app.get(CoreConfigService);

  app.setGlobalPrefix(coreConfigService.apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(app.get(AppExceptionFilter));

  await app.listen(coreConfigService.port);
}

bootstrap();
