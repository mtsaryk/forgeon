import fs from 'node:fs';
import path from 'node:path';
import { removeIfExists, writeJson } from '../utils/fs.mjs';

export function applyI18nDisabled(targetRoot) {
  removeIfExists(path.join(targetRoot, 'packages', 'i18n'));
  removeIfExists(path.join(targetRoot, 'packages', 'i18n-contracts'));
  removeIfExists(path.join(targetRoot, 'packages', 'i18n-web'));
  removeIfExists(path.join(targetRoot, 'resources', 'i18n'));
  removeIfExists(path.join(targetRoot, 'scripts', 'i18n-add.mjs'));

  const apiPackagePath = path.join(targetRoot, 'apps', 'api', 'package.json');
  if (fs.existsSync(apiPackagePath)) {
    const apiPackage = JSON.parse(fs.readFileSync(apiPackagePath, 'utf8'));

    if (apiPackage.scripts) {
      const currentPredev = typeof apiPackage.scripts.predev === 'string' ? apiPackage.scripts.predev : '';
      const nextSteps = currentPredev
        .split('&&')
        .map((item) => item.trim())
        .filter(Boolean)
        .filter(
          (step) =>
            step !== 'pnpm --filter @forgeon/i18n-contracts build' &&
            step !== 'pnpm --filter @forgeon/i18n build',
        );

      if (nextSteps.length > 0) {
        apiPackage.scripts.predev = nextSteps.join(' && ');
      } else {
        delete apiPackage.scripts.predev;
      }
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
      const removeI18nBuildSteps = (scriptValue) => {
        if (typeof scriptValue !== 'string') {
          return scriptValue;
        }

        const next = scriptValue
          .split('&&')
          .map((item) => item.trim())
          .filter(Boolean)
          .filter(
            (step) =>
              step !== 'pnpm --filter @forgeon/i18n-contracts build' &&
              step !== 'pnpm --filter @forgeon/i18n-web build',
          );

        return next.length > 0 ? next.join(' && ') : undefined;
      };

      const nextPredev = removeI18nBuildSteps(webPackage.scripts.predev);
      if (nextPredev) {
        webPackage.scripts.predev = nextPredev;
      } else {
        delete webPackage.scripts.predev;
      }

      const nextPrebuild = removeI18nBuildSteps(webPackage.scripts.prebuild);
      if (nextPrebuild) {
        webPackage.scripts.prebuild = nextPrebuild;
      } else {
        delete webPackage.scripts.prebuild;
      }
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
      if (typeof rootPackage.scripts.postinstall === 'string') {
        const nextPostinstall = rootPackage.scripts.postinstall
          .replace(/\s*&&\s*pnpm i18n:sync/g, '')
          .replace(/pnpm i18n:sync\s*&&\s*/g, '')
          .trim();
        if (nextPostinstall.length === 0) {
          delete rootPackage.scripts.postinstall;
        } else {
          rootPackage.scripts.postinstall = nextPostinstall;
        }
      }
      delete rootPackage.scripts['i18n:sync'];
      delete rootPackage.scripts['i18n:check'];
      delete rootPackage.scripts['i18n:types'];
      delete rootPackage.scripts['i18n:add'];
    }
    writeJson(rootPackagePath, rootPackage);
  }

  const appModulePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  fs.writeFileSync(
    appModulePath,
    `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoreConfigModule, CoreErrorsModule, coreConfig, coreEnvSchema, createEnvValidator } from '@forgeon/core';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [coreConfig],
      validate: createEnvValidator([coreEnvSchema]),
      envFilePath: '.env',
    }),
    CoreConfigModule,
    CoreErrorsModule,
  ],
  controllers: [HealthController],
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
    `import { BadRequestException, ConflictException, Controller, Get, Query } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      message: 'OK',
      i18n: 'disabled',
    };
  }

  @Get('error')
  getErrorProbe() {
    throw new ConflictException({
      message: 'Email already exists',
      details: {
        feature: 'core-errors',
        probeId: 'health.error',
        probe: 'Error envelope probe',
      },
    });
  }

  @Get('validation')
  getValidationProbe(@Query('value') value?: string) {
    if (!value || value.trim().length === 0) {
      throw new BadRequestException({
        message: 'Field is required',
        details: [{ field: 'value', message: 'Field is required' }],
      });
    }

    return {
      status: 'ok',
      validated: true,
      value,
    };
  }
}
`,
    'utf8',
  );

  removeIfExists(
    path.join(targetRoot, 'apps', 'api', 'src', 'common', 'filters', 'app-exception.filter.ts'),
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
