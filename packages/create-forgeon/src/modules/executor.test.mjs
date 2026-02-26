import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addModule } from './executor.mjs';
import { scaffoldProject } from '../core/scaffold.mjs';

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createMinimalForgeonProject(targetRoot) {
  fs.mkdirSync(path.join(targetRoot, 'apps', 'api'), { recursive: true });
  fs.writeFileSync(path.join(targetRoot, 'package.json'), '{"name":"demo"}\n', 'utf8');
  fs.writeFileSync(path.join(targetRoot, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n', 'utf8');
}

describe('addModule', () => {
  const modulesDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(modulesDir, '..', '..');

  it('creates module docs note for planned module', () => {
    const targetRoot = mkTmp('forgeon-module-');
    try {
      createMinimalForgeonProject(targetRoot);
      const result = addModule({
        moduleId: 'jwt-auth',
        targetRoot,
        packageRoot,
      });

      assert.equal(result.applied, false);
      assert.match(result.message, /planned/);
      assert.equal(fs.existsSync(result.docsPath), true);

      const note = fs.readFileSync(result.docsPath, 'utf8');
      assert.match(note, /JWT Auth/);
      assert.match(note, /Status: planned/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('throws for unknown module id', () => {
    const targetRoot = mkTmp('forgeon-module-unknown-');
    try {
      createMinimalForgeonProject(targetRoot);
      assert.throws(
        () =>
          addModule({
            moduleId: 'unknown-module',
            targetRoot,
            packageRoot,
          }),
        /Unknown module/,
      );
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies i18n module on top of scaffold without i18n', () => {
    const targetRoot = mkTmp('forgeon-module-i18n-');
    const projectRoot = path.join(targetRoot, 'demo-i18n');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-i18n',
        frontend: 'react',
        db: 'prisma',
        i18nEnabled: false,
        proxy: 'caddy',
      });

      const result = addModule({
        moduleId: 'i18n',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assert.match(result.message, /applied/);
      assert.equal(
        fs.existsSync(path.join(projectRoot, 'packages', 'i18n-contracts', 'package.json')),
        true,
      );
      assert.equal(
        fs.existsSync(path.join(projectRoot, 'packages', 'i18n-web', 'package.json')),
        true,
      );
      assert.equal(fs.existsSync(path.join(projectRoot, 'tsconfig.base.node.json')), true);
      assert.equal(fs.existsSync(path.join(projectRoot, 'tsconfig.base.esm.json')), true);

      const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
      assert.match(apiPackage, /@forgeon\/db-prisma/);
      assert.match(apiPackage, /@forgeon\/i18n/);
      assert.match(apiPackage, /@forgeon\/i18n-contracts/);

      const apiTsconfig = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'tsconfig.json'), 'utf8');
      assert.match(apiTsconfig, /tsconfig\.base\.node\.json/);

      const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
      assert.match(compose, /I18N_DEFAULT_LANG/);
      assert.doesNotMatch(compose, /I18N_ENABLED/);

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      assert.match(appModule, /coreConfig/);
      assert.match(appModule, /dbPrismaConfig/);
      assert.match(appModule, /dbPrismaEnvSchema/);
      assert.match(appModule, /createEnvValidator/);
      assert.match(appModule, /coreEnvSchema/);
      assert.match(appModule, /i18nConfig/);
      assert.match(appModule, /i18nEnvSchema/);
      assert.match(appModule, /CoreConfigModule/);
      assert.match(appModule, /CoreErrorsModule/);
      assert.match(appModule, /DbPrismaModule/);

      const mainTs = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'main.ts'), 'utf8');
      assert.match(mainTs, /CoreExceptionFilter/);
      assert.match(mainTs, /createValidationPipe/);
      assert.doesNotMatch(mainTs, /new ValidationPipe\(/);

      const forgeonI18nModule = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n', 'src', 'forgeon-i18n.module.ts'),
        'utf8',
      );
      assert.match(forgeonI18nModule, /const resolvers = \[/);
      assert.match(forgeonI18nModule, /I18nModule\.forRootAsync\([\s\S]*resolvers,/);
      assert.doesNotMatch(
        forgeonI18nModule,
        /exports:\s*\[I18nModule,\s*I18nConfigModule,\s*I18nConfigService\]/,
      );

      const appTsx = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'App.tsx'), 'utf8');
      assert.match(appTsx, /@forgeon\/i18n-web/);
      assert.match(appTsx, /react-i18next/);
      assert.match(appTsx, /ui:labels\.language/);

      const i18nWebPackage = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n-web', 'package.json'),
        'utf8',
      );
      assert.match(i18nWebPackage, /"type": "module"/);

      const i18nContractsPackage = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n-contracts', 'package.json'),
        'utf8',
      );
      assert.match(i18nContractsPackage, /"type": "module"/);

      const i18nWebTsconfig = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n-web', 'tsconfig.json'),
        'utf8',
      );
      assert.match(i18nWebTsconfig, /tsconfig\.base\.esm\.json/);

      const i18nContractsTsconfig = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n-contracts', 'tsconfig.json'),
        'utf8',
      );
      assert.match(i18nContractsTsconfig, /tsconfig\.base\.esm\.json/);

      const i18nWebSource = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n-web', 'src', 'index.ts'),
        'utf8',
      );
      assert.match(i18nWebSource, /@forgeon\/i18n-contracts/);
      assert.doesNotMatch(i18nWebSource, /I18N_DEFAULT_LANG/);

      const i18nContractsIndex = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n-contracts', 'src', 'index.ts'),
        'utf8',
      );
      assert.match(i18nContractsIndex, /from '\.\/generated'/);
      assert.doesNotMatch(i18nContractsIndex, /I18N_DEFAULT_LANG/);
      assert.doesNotMatch(i18nContractsIndex, /I18N_FALLBACK_LANG/);

      const enCommon = JSON.parse(
        fs.readFileSync(path.join(projectRoot, 'resources', 'i18n', 'en', 'common.json'), 'utf8'),
      );
      assert.equal(enCommon.actions.ok, 'OK');
      assert.equal(enCommon.nav.next, 'Next');

      const enErrors = JSON.parse(
        fs.readFileSync(path.join(projectRoot, 'resources', 'i18n', 'en', 'errors.json'), 'utf8'),
      );
      assert.equal(enErrors.http.NOT_FOUND, 'Resource not found');
      assert.equal(enErrors.validation.VALIDATION_ERROR, 'Validation error');

      const webPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'package.json'), 'utf8');
      assert.match(webPackage, /"i18next":/);
      assert.match(webPackage, /"react-i18next":/);

      const mainTsx = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'main.tsx'), 'utf8');
      assert.match(mainTsx, /import '\.\/i18n';/);

      const i18nTs = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'i18n.ts'), 'utf8');
      assert.match(i18nTs, /initReactI18next/);
      assert.match(i18nTs, /\.\.\/\.\.\/\.\.\/resources\/i18n\/en\/common\.json/);
      assert.match(i18nTs, /\.\.\/\.\.\/\.\.\/resources\/i18n\/en\/ui\.json/);
      assert.doesNotMatch(i18nTs, /I18N_DEFAULT_LANG/);

      const rootPackage = fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8');
      assert.match(rootPackage, /"i18n:sync"/);
      assert.match(rootPackage, /"i18n:check"/);
      assert.match(rootPackage, /"i18n:types"/);
      assert.match(rootPackage, /"i18n:add"/);

      const i18nAddScriptPath = path.join(projectRoot, 'scripts', 'i18n-add.mjs');
      assert.equal(fs.existsSync(i18nAddScriptPath), true);

      const caddyDockerfile = fs.readFileSync(
        path.join(projectRoot, 'infra', 'docker', 'caddy.Dockerfile'),
        'utf8',
      );
      assert.match(caddyDockerfile, /COPY tsconfig\.base\.json \.\//);
      assert.match(caddyDockerfile, /COPY tsconfig\.base\.node\.json \.\//);
      assert.match(caddyDockerfile, /COPY tsconfig\.base\.esm\.json \.\//);
      assert.match(
        caddyDockerfile,
        /COPY packages\/i18n-contracts\/package\.json packages\/i18n-contracts\/package\.json/,
      );
      assert.match(
        caddyDockerfile,
        /COPY packages\/i18n-web\/package\.json packages\/i18n-web\/package\.json/,
      );
      assert.match(caddyDockerfile, /COPY resources resources/);

      const apiDockerfile = fs.readFileSync(
        path.join(projectRoot, 'apps', 'api', 'Dockerfile'),
        'utf8',
      );
      assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/core build/);
      assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/db-prisma build/);
      assert.match(apiDockerfile, /COPY packages\/db-prisma\/package\.json packages\/db-prisma\/package\.json/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies logger module on top of scaffold without i18n', () => {
    const targetRoot = mkTmp('forgeon-module-logger-');
    const projectRoot = path.join(targetRoot, 'demo-logger');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-logger',
        frontend: 'react',
        db: 'prisma',
        i18nEnabled: false,
        proxy: 'caddy',
      });

      const result = addModule({
        moduleId: 'logger',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assert.match(result.message, /applied/);
      assert.equal(
        fs.existsSync(path.join(projectRoot, 'packages', 'logger', 'package.json')),
        true,
      );

      const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
      assert.match(apiPackage, /@forgeon\/logger/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/logger build/);

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      assert.match(appModule, /@forgeon\/logger/);
      assert.match(appModule, /loggerConfig/);
      assert.match(appModule, /loggerEnvSchema/);
      assert.match(appModule, /ForgeonLoggerModule/);

      const mainTs = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'main.ts'), 'utf8');
      assert.match(mainTs, /ForgeonLoggerService/);
      assert.match(mainTs, /ForgeonHttpLoggingInterceptor/);
      assert.match(mainTs, /bufferLogs: true/);
      assert.match(mainTs, /app\.useLogger\(app\.get\(ForgeonLoggerService\)\);/);
      assert.match(mainTs, /app\.useGlobalInterceptors\(app\.get\(ForgeonHttpLoggingInterceptor\)\);/);

      const apiDockerfile = fs.readFileSync(
        path.join(projectRoot, 'apps', 'api', 'Dockerfile'),
        'utf8',
      );
      assert.match(apiDockerfile, /COPY packages\/logger\/package\.json packages\/logger\/package\.json/);
      assert.match(apiDockerfile, /COPY packages\/logger packages\/logger/);
      assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/logger build/);

      const apiEnv = fs.readFileSync(path.join(projectRoot, 'apps', 'api', '.env.example'), 'utf8');
      assert.match(apiEnv, /LOGGER_LEVEL=log/);
      assert.match(apiEnv, /LOGGER_HTTP_ENABLED=true/);
      assert.match(apiEnv, /LOGGER_REQUEST_ID_HEADER=x-request-id/);

      const dockerEnv = fs.readFileSync(
        path.join(projectRoot, 'infra', 'docker', '.env.example'),
        'utf8',
      );
      assert.match(dockerEnv, /LOGGER_LEVEL=log/);
      assert.match(dockerEnv, /LOGGER_HTTP_ENABLED=true/);
      assert.match(dockerEnv, /LOGGER_REQUEST_ID_HEADER=x-request-id/);

      const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
      assert.match(compose, /LOGGER_LEVEL: \$\{LOGGER_LEVEL\}/);
      assert.match(compose, /LOGGER_HTTP_ENABLED: \$\{LOGGER_HTTP_ENABLED\}/);
      assert.match(compose, /LOGGER_REQUEST_ID_HEADER: \$\{LOGGER_REQUEST_ID_HEADER\}/);

      const moduleDoc = fs.readFileSync(result.docsPath, 'utf8');
      assert.match(moduleDoc, /Logger/);
      assert.match(moduleDoc, /Status: implemented/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });
});
