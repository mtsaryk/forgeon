import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SwaggerConfigService } from './swagger-config.service';

export function setupSwagger(app: INestApplication, config: SwaggerConfigService): void {
  if (!config.enabled) {
    return;
  }

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(config.title)
      .setVersion(config.version)
      .addBearerAuth()
      .build(),
  );

  SwaggerModule.setup(config.path, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}

