import fs from 'node:fs';
import path from 'node:path';
import { removeIfExists, writeJson } from '../utils/fs.mjs';

export function applyI18nDisabled(targetRoot) {
  removeIfExists(path.join(targetRoot, 'packages', 'i18n'));
  removeIfExists(path.join(targetRoot, 'packages', 'i18n-contracts'));
  removeIfExists(path.join(targetRoot, 'packages', 'i18n-web'));
  removeIfExists(path.join(targetRoot, 'resources', 'i18n'));

  const apiPackagePath = path.join(targetRoot, 'apps', 'api', 'package.json');
  if (fs.existsSync(apiPackagePath)) {
    const apiPackage = JSON.parse(fs.readFileSync(apiPackagePath, 'utf8'));

    if (apiPackage.scripts) {
      delete apiPackage.scripts.predev;
    }

    if (apiPackage.dependencies) {
      delete apiPackage.dependencies['@forgeon/i18n'];
      delete apiPackage.dependencies['@forgeon/i18n-contracts'];
      delete apiPackage.dependencies['nestjs-i18n'];
    }

    writeJson(apiPackagePath, apiPackage);
  }

  const apiDockerfile = path.join(targetRoot, 'apps', 'api', 'Dockerfile');
  if (fs.existsSync(apiDockerfile)) {
    let content = fs.readFileSync(apiDockerfile, 'utf8');
    content = content
      .replace(/^COPY packages\/i18n\/package\.json packages\/i18n\/package\.json\r?\n/gm, '')
      .replace(
        /^COPY packages\/i18n-contracts\/package\.json packages\/i18n-contracts\/package\.json\r?\n/gm,
        '',
      )
      .replace(/^COPY packages\/i18n packages\/i18n\r?\n/gm, '')
      .replace(/^COPY packages\/i18n-contracts packages\/i18n-contracts\r?\n/gm, '')
      .replace(/^RUN pnpm --filter @forgeon\/i18n build\r?\n/gm, '')
      .replace(/^RUN pnpm --filter @forgeon\/i18n-contracts build\r?\n/gm, '');
    fs.writeFileSync(apiDockerfile, content, 'utf8');
  }

  const proxyDockerfiles = [
    path.join(targetRoot, 'infra', 'docker', 'caddy.Dockerfile'),
    path.join(targetRoot, 'infra', 'docker', 'nginx.Dockerfile'),
  ];
  for (const dockerfilePath of proxyDockerfiles) {
    if (!fs.existsSync(dockerfilePath)) {
      continue;
    }

    const content = fs
      .readFileSync(dockerfilePath, 'utf8')
      .replace(
        /^COPY packages\/i18n-contracts\/package\.json packages\/i18n-contracts\/package\.json\r?\n/gm,
        '',
      )
      .replace(/^COPY packages\/i18n-web\/package\.json packages\/i18n-web\/package\.json\r?\n/gm, '')
      .replace(/^COPY packages\/i18n-contracts packages\/i18n-contracts\r?\n/gm, '')
      .replace(/^COPY packages\/i18n-web packages\/i18n-web\r?\n/gm, '')
      .replace(/^COPY resources resources\r?\n/gm, '');

    fs.writeFileSync(dockerfilePath, content, 'utf8');
  }

  const webPackagePath = path.join(targetRoot, 'apps', 'web', 'package.json');
  if (fs.existsSync(webPackagePath)) {
    const webPackage = JSON.parse(fs.readFileSync(webPackagePath, 'utf8'));

    if (webPackage.scripts) {
      delete webPackage.scripts.predev;
      delete webPackage.scripts.prebuild;
    }

    if (webPackage.dependencies) {
      delete webPackage.dependencies['@forgeon/i18n-contracts'];
      delete webPackage.dependencies['@forgeon/i18n-web'];
      delete webPackage.dependencies.i18next;
      delete webPackage.dependencies['react-i18next'];
    }

    writeJson(webPackagePath, webPackage);
  }

  const rootPackagePath = path.join(targetRoot, 'package.json');
  if (fs.existsSync(rootPackagePath)) {
    const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
    if (rootPackage.scripts) {
      delete rootPackage.scripts['i18n:check'];
    }
    writeJson(rootPackagePath, rootPackage);
  }

  const appModulePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  fs.writeFileSync(
    appModulePath,
    `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoreConfigModule, coreConfig, validateCoreEnv } from '@forgeon/core';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [coreConfig],
      validate: validateCoreEnv,
      envFilePath: '.env',
    }),
    CoreConfigModule,
    PrismaModule,
  ],
  controllers: [HealthController],
  providers: [AppExceptionFilter],
})
export class AppModule {}
`,
    'utf8',
  );

  const healthControllerPath = path.join(
    targetRoot,
    'apps',
    'api',
    'src',
    'health',
    'health.controller.ts',
  );
  fs.writeFileSync(
    healthControllerPath,
    `import { Controller, Get, Query } from '@nestjs/common';
import { EchoQueryDto } from '../common/dto/echo-query.dto';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(@Query('lang') _lang?: string) {
    return {
      status: 'ok',
      message: 'OK',
    };
  }

  @Get('echo')
  getEcho(@Query() query: EchoQueryDto) {
    return { value: query.value };
  }
}
`,
    'utf8',
  );

  const filterPath = path.join(
    targetRoot,
    'apps',
    'api',
    'src',
    'common',
    'filters',
    'app-exception.filter.ts',
  );
  fs.writeFileSync(
    filterPath,
    `import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Response } from 'express';

@Injectable()
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? Array.isArray((payload as { message?: unknown }).message)
          ? String((payload as { message: unknown[] }).message[0] ?? 'Internal server error')
          : String((payload as { message?: unknown }).message ?? 'Internal server error')
        : typeof payload === 'string'
          ? payload
          : 'Internal server error';

    response.status(status).json({
      error: {
        code: this.resolveCode(status),
        message,
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
}
`,
    'utf8',
  );
}

export function patchDockerEnvForI18n(targetRoot, i18nEnabled) {
  const dockerEnvPath = path.join(targetRoot, 'infra', 'docker', '.env.example');
  if (fs.existsSync(dockerEnvPath) && !i18nEnabled) {
    const content = fs
      .readFileSync(dockerEnvPath, 'utf8')
      .replace(/^I18N_ENABLED=.*\r?\n/gm, '')
      .replace(/^I18N_DEFAULT_LANG=.*\r?\n/gm, '')
      .replace(/^I18N_FALLBACK_LANG=.*\r?\n/gm, '');
    fs.writeFileSync(dockerEnvPath, content.trimEnd() + '\n', 'utf8');
  }

  const composePath = path.join(targetRoot, 'infra', 'docker', 'compose.yml');
  if (fs.existsSync(composePath) && !i18nEnabled) {
    const content = fs
      .readFileSync(composePath, 'utf8')
      .replace(/^\s+I18N_ENABLED:.*\r?\n/gm, '')
      .replace(/^\s+I18N_DEFAULT_LANG:.*\r?\n/gm, '')
      .replace(/^\s+I18N_FALLBACK_LANG:.*\r?\n/gm, '');
    fs.writeFileSync(composePath, content, 'utf8');
  }
}
