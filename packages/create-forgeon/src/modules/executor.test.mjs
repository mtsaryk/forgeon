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

function assertDbPrismaWiring(projectRoot) {
  const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
  assert.match(appModule, /dbPrismaConfig/);
  assert.match(appModule, /dbPrismaEnvSchema/);
  assert.match(appModule, /DbPrismaModule/);

  const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
  assert.match(apiPackage, /@forgeon\/db-prisma/);

  const apiDockerfile = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'Dockerfile'), 'utf8');
  assert.match(apiDockerfile, /COPY packages\/db-prisma\/package\.json packages\/db-prisma\/package\.json/);
  assert.match(apiDockerfile, /COPY packages\/db-prisma packages\/db-prisma/);
  assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/db-prisma build/);

  const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
  assert.match(compose, /DATABASE_URL: \$\{DATABASE_URL\}/);

  const healthController = fs.readFileSync(
    path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
    'utf8',
  );
  assert.match(healthController, /PrismaService/);
}

function assertJwtAuthWiring(projectRoot, withPrismaStore) {
  const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
  assert.match(apiPackage, /@forgeon\/auth-api/);
  assert.match(apiPackage, /@forgeon\/auth-contracts/);
  assert.match(apiPackage, /pnpm --filter @forgeon\/auth-contracts build/);
  assert.match(apiPackage, /pnpm --filter @forgeon\/auth-api build/);

  const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
  assert.match(appModule, /authConfig/);
  assert.match(appModule, /authEnvSchema/);
  assert.match(appModule, /ForgeonAuthModule\.register\(/);
  if (withPrismaStore) {
    assert.match(appModule, /AUTH_REFRESH_TOKEN_STORE/);
    assert.match(appModule, /PrismaAuthRefreshTokenStore/);
  } else {
    assert.doesNotMatch(appModule, /PrismaAuthRefreshTokenStore/);
  }

  const healthController = fs.readFileSync(
    path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
    'utf8',
  );
  assert.match(healthController, /@Get\('auth'\)/);
  assert.match(healthController, /authService\.getProbeStatus/);
  assert.doesNotMatch(healthController, /,\s*,/);

  const appTsx = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'App.tsx'), 'utf8');
  assert.match(appTsx, /Check JWT auth probe/);
  assert.match(appTsx, /Auth probe response/);

  const apiDockerfile = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'Dockerfile'), 'utf8');
  assert.match(
    apiDockerfile,
    /COPY packages\/auth-contracts\/package\.json packages\/auth-contracts\/package\.json/,
  );
  assert.match(apiDockerfile, /COPY packages\/auth-api\/package\.json packages\/auth-api\/package\.json/);
  assert.match(apiDockerfile, /COPY packages\/auth-contracts packages\/auth-contracts/);
  assert.match(apiDockerfile, /COPY packages\/auth-api packages\/auth-api/);
  assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/auth-contracts build/);
  assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/auth-api build/);

  const apiEnv = fs.readFileSync(path.join(projectRoot, 'apps', 'api', '.env.example'), 'utf8');
  assert.match(apiEnv, /JWT_ACCESS_SECRET=/);
  assert.match(apiEnv, /JWT_REFRESH_SECRET=/);
  assert.match(apiEnv, /AUTH_DEMO_EMAIL=/);
  assert.match(apiEnv, /AUTH_DEMO_PASSWORD=/);

  const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
  assert.match(compose, /JWT_ACCESS_SECRET: \$\{JWT_ACCESS_SECRET\}/);
  assert.match(compose, /JWT_REFRESH_SECRET: \$\{JWT_REFRESH_SECRET\}/);

  const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
  assert.match(readme, /## JWT Auth Module/);

  const authServiceSource = fs.readFileSync(
    path.join(projectRoot, 'packages', 'auth-api', 'src', 'auth.service.ts'),
    'utf8',
  );
  assert.match(authServiceSource, /import type \{/);
  assert.doesNotMatch(authServiceSource, /import\s*\{\s*AUTH_ERROR_CODES/);
}

function stripDbPrismaArtifacts(projectRoot) {
  const dbPackageDir = path.join(projectRoot, 'packages', 'db-prisma');
  if (fs.existsSync(dbPackageDir)) {
    fs.rmSync(dbPackageDir, { recursive: true, force: true });
  }

  const prismaDir = path.join(projectRoot, 'apps', 'api', 'prisma');
  if (fs.existsSync(prismaDir)) {
    fs.rmSync(prismaDir, { recursive: true, force: true });
  }

  const apiPackagePath = path.join(projectRoot, 'apps', 'api', 'package.json');
  const apiPackage = JSON.parse(fs.readFileSync(apiPackagePath, 'utf8'));
  if (apiPackage.dependencies) {
    delete apiPackage.dependencies['@forgeon/db-prisma'];
    delete apiPackage.dependencies['@prisma/client'];
  }
  if (apiPackage.devDependencies) {
    delete apiPackage.devDependencies.prisma;
  }
  if (apiPackage.scripts) {
    for (const key of Object.keys(apiPackage.scripts)) {
      if (key.startsWith('prisma:')) {
        delete apiPackage.scripts[key];
      }
    }
    if (typeof apiPackage.scripts.predev === 'string') {
      apiPackage.scripts.predev = apiPackage.scripts.predev
        .replace('pnpm --filter @forgeon/db-prisma build && ', '')
        .replace(' && pnpm --filter @forgeon/db-prisma build', '')
        .replace('pnpm --filter @forgeon/db-prisma build', '')
        .trim();
      if (apiPackage.scripts.predev.length === 0) {
        delete apiPackage.scripts.predev;
      }
    }
  }
  delete apiPackage.prisma;
  fs.writeFileSync(apiPackagePath, `${JSON.stringify(apiPackage, null, 2)}\n`, 'utf8');

  const rootPackagePath = path.join(projectRoot, 'package.json');
  const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
  if (rootPackage.scripts && typeof rootPackage.scripts.postinstall === 'string') {
    rootPackage.scripts.postinstall = rootPackage.scripts.postinstall
      .replace(/\s*&&\s*pnpm --filter @forgeon\/api prisma:generate/g, '')
      .replace(/pnpm --filter @forgeon\/api prisma:generate\s*&&\s*/g, '')
      .trim();
    if (rootPackage.scripts.postinstall.length === 0) {
      delete rootPackage.scripts.postinstall;
    }
  }
  fs.writeFileSync(rootPackagePath, `${JSON.stringify(rootPackage, null, 2)}\n`, 'utf8');

  const appModulePath = path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts');
  let appModule = fs.readFileSync(appModulePath, 'utf8');
  appModule = appModule
    .replace(/^import \{ dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule \} from '@forgeon\/db-prisma';\r?\n/m, '')
    .replace(/,\s*dbPrismaConfig/g, '')
    .replace(/dbPrismaConfig,\s*/g, '')
    .replace(/,\s*dbPrismaEnvSchema/g, '')
    .replace(/dbPrismaEnvSchema,\s*/g, '')
    .replace(/^\s*DbPrismaModule,\r?\n/gm, '');
  fs.writeFileSync(appModulePath, appModule, 'utf8');

  const healthControllerPath = path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts');
  let healthController = fs.readFileSync(healthControllerPath, 'utf8');
  healthController = healthController
    .replace(/^import \{ PrismaService \} from '@forgeon\/db-prisma';\r?\n/m, '')
    .replace(/\s*private readonly prisma: PrismaService,\r?\n/g, '\n')
    .replace(
      /\s*@Post\('db'\)\s*async getDbProbe\(\)\s*\{[\s\S]*?\n\s*\}\r?\n/g,
      '\n',
    );
  fs.writeFileSync(healthControllerPath, healthController, 'utf8');

  const apiDockerfilePath = path.join(projectRoot, 'apps', 'api', 'Dockerfile');
  let apiDockerfile = fs.readFileSync(apiDockerfilePath, 'utf8');
  apiDockerfile = apiDockerfile
    .replace(/^COPY apps\/api\/prisma apps\/api\/prisma\r?\n/gm, '')
    .replace(/^COPY packages\/db-prisma\/package\.json packages\/db-prisma\/package\.json\r?\n/gm, '')
    .replace(/^COPY packages\/db-prisma packages\/db-prisma\r?\n/gm, '')
    .replace(/^RUN pnpm --filter @forgeon\/db-prisma build\r?\n/gm, '')
    .replace(/^RUN pnpm --filter @forgeon\/api prisma:generate\r?\n/gm, '');
  fs.writeFileSync(apiDockerfilePath, apiDockerfile, 'utf8');

  const composePath = path.join(projectRoot, 'infra', 'docker', 'compose.yml');
  let compose = fs.readFileSync(composePath, 'utf8');
  compose = compose.replace(/^\s+DATABASE_URL:.*\r?\n/gm, '');
  fs.writeFileSync(composePath, compose, 'utf8');

  const apiEnvExamplePath = path.join(projectRoot, 'apps', 'api', '.env.example');
  let apiEnv = fs.readFileSync(apiEnvExamplePath, 'utf8');
  apiEnv = apiEnv.replace(/^DATABASE_URL=.*\r?\n/gm, '');
  fs.writeFileSync(apiEnvExamplePath, apiEnv, 'utf8');

  const dockerEnvExamplePath = path.join(projectRoot, 'infra', 'docker', '.env.example');
  let dockerEnv = fs.readFileSync(dockerEnvExamplePath, 'utf8');
  dockerEnv = dockerEnv.replace(/^DATABASE_URL=.*\r?\n/gm, '');
  fs.writeFileSync(dockerEnvExamplePath, dockerEnv, 'utf8');
}

describe('addModule', () => {
  const modulesDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(modulesDir, '..', '..');

  it('creates module docs note for planned module', () => {
    const targetRoot = mkTmp('forgeon-module-');
    try {
      createMinimalForgeonProject(targetRoot);
      const result = addModule({
        moduleId: 'queue',
        targetRoot,
        packageRoot,
      });

      assert.equal(result.applied, false);
      assert.match(result.message, /planned/);
      assert.equal(fs.existsSync(result.docsPath), true);

      const note = fs.readFileSync(result.docsPath, 'utf8');
      assert.match(note, /Queue Worker/);
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
        dbPrismaEnabled: true,
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
      assert.match(rootPackage, /"forgeon:sync-integrations"/);
      assert.match(rootPackage, /"i18n:sync"/);
      assert.match(rootPackage, /"i18n:check"/);
      assert.match(rootPackage, /"i18n:types"/);
      assert.match(rootPackage, /"i18n:add"/);
      assert.match(rootPackage, /"ts-morph":/);

      const i18nAddScriptPath = path.join(projectRoot, 'scripts', 'i18n-add.mjs');
      assert.equal(fs.existsSync(i18nAddScriptPath), true);
      const syncScriptPath = path.join(projectRoot, 'scripts', 'forgeon-sync-integrations.mjs');
      assert.equal(fs.existsSync(syncScriptPath), true);

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
        dbPrismaEnabled: true,
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

      const loggerTsconfig = fs.readFileSync(
        path.join(projectRoot, 'packages', 'logger', 'tsconfig.json'),
        'utf8',
      );
      assert.match(loggerTsconfig, /"extends": "\.\.\/\.\.\/tsconfig\.base\.node\.json"/);

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

      const rootReadme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
      assert.match(rootReadme, /## Logger Module/);
      assert.match(rootReadme, /LOGGER_LEVEL=log/);
      assert.match(rootReadme, /docker compose logs api/);

      const moduleDoc = fs.readFileSync(result.docsPath, 'utf8');
      assert.match(moduleDoc, /Logger/);
      assert.match(moduleDoc, /Status: implemented/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies swagger module on top of scaffold without i18n', () => {
    const targetRoot = mkTmp('forgeon-module-swagger-');
    const projectRoot = path.join(targetRoot, 'demo-swagger');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-swagger',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      const result = addModule({
        moduleId: 'swagger',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assert.match(result.message, /applied/);
      assert.equal(
        fs.existsSync(path.join(projectRoot, 'packages', 'swagger', 'package.json')),
        true,
      );

      const swaggerTsconfig = fs.readFileSync(
        path.join(projectRoot, 'packages', 'swagger', 'tsconfig.json'),
        'utf8',
      );
      assert.match(swaggerTsconfig, /"extends": "\.\.\/\.\.\/tsconfig\.base\.node\.json"/);

      const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
      assert.match(apiPackage, /@forgeon\/swagger/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/swagger build/);

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      assert.match(appModule, /@forgeon\/swagger/);
      assert.match(appModule, /swaggerConfig/);
      assert.match(appModule, /swaggerEnvSchema/);
      assert.match(appModule, /ForgeonSwaggerModule/);

      const mainTs = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'main.ts'), 'utf8');
      assert.match(mainTs, /setupSwagger/);
      assert.match(mainTs, /SwaggerConfigService/);
      assert.match(mainTs, /setupSwagger\(app,\s*swaggerConfigService\)/);

      const apiDockerfile = fs.readFileSync(
        path.join(projectRoot, 'apps', 'api', 'Dockerfile'),
        'utf8',
      );
      assert.match(apiDockerfile, /COPY packages\/swagger\/package\.json packages\/swagger\/package\.json/);
      assert.match(apiDockerfile, /COPY packages\/swagger packages\/swagger/);
      assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/swagger build/);

      const apiEnv = fs.readFileSync(path.join(projectRoot, 'apps', 'api', '.env.example'), 'utf8');
      assert.match(apiEnv, /SWAGGER_ENABLED=false/);
      assert.match(apiEnv, /SWAGGER_PATH=docs/);
      assert.match(apiEnv, /SWAGGER_TITLE="Forgeon API"/);
      assert.match(apiEnv, /SWAGGER_VERSION=1\.0\.0/);

      const dockerEnv = fs.readFileSync(
        path.join(projectRoot, 'infra', 'docker', '.env.example'),
        'utf8',
      );
      assert.match(dockerEnv, /SWAGGER_ENABLED=false/);
      assert.match(dockerEnv, /SWAGGER_PATH=docs/);
      assert.match(dockerEnv, /SWAGGER_TITLE="Forgeon API"/);
      assert.match(dockerEnv, /SWAGGER_VERSION=1\.0\.0/);

      const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
      assert.match(compose, /SWAGGER_ENABLED: \$\{SWAGGER_ENABLED\}/);
      assert.match(compose, /SWAGGER_PATH: \$\{SWAGGER_PATH\}/);
      assert.match(compose, /SWAGGER_TITLE: \$\{SWAGGER_TITLE\}/);
      assert.match(compose, /SWAGGER_VERSION: \$\{SWAGGER_VERSION\}/);

      const rootReadme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
      assert.match(rootReadme, /## Swagger \/ OpenAPI Module/);
      assert.match(rootReadme, /SWAGGER_ENABLED=false/);
      assert.match(rootReadme, /localhost:3000\/api\/docs/);

      const moduleDoc = fs.readFileSync(result.docsPath, 'utf8');
      assert.match(moduleDoc, /Swagger \/ OpenAPI/);
      assert.match(moduleDoc, /Status: implemented/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies swagger module on top of scaffold with i18n', () => {
    const targetRoot = mkTmp('forgeon-module-swagger-i18n-');
    const projectRoot = path.join(targetRoot, 'demo-swagger-i18n');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-swagger-i18n',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: true,
        proxy: 'caddy',
      });

      const result = addModule({
        moduleId: 'swagger',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      const loadMatch = appModule.match(/load: \[([^\]]+)\]/);
      assert.ok(loadMatch);
      assert.match(loadMatch[1], /coreConfig/);
      assert.match(loadMatch[1], /dbPrismaConfig/);
      assert.match(loadMatch[1], /i18nConfig/);
      assert.match(loadMatch[1], /swaggerConfig/);

      const validateMatch = appModule.match(/validate: createEnvValidator\(\[([^\]]+)\]\)/);
      assert.ok(validateMatch);
      assert.match(validateMatch[1], /coreEnvSchema/);
      assert.match(validateMatch[1], /dbPrismaEnvSchema/);
      assert.match(validateMatch[1], /i18nEnvSchema/);
      assert.match(validateMatch[1], /swaggerEnvSchema/);
      assert.match(appModule, /ForgeonSwaggerModule/);
      assert.match(appModule, /ForgeonI18nModule/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies logger after swagger without losing logger config keys', () => {
    const targetRoot = mkTmp('forgeon-module-swagger-logger-');
    const projectRoot = path.join(targetRoot, 'demo-swagger-logger');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-swagger-logger',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: true,
        proxy: 'caddy',
      });

      const swaggerResult = addModule({
        moduleId: 'swagger',
        targetRoot: projectRoot,
        packageRoot,
      });
      assert.equal(swaggerResult.applied, true);

      const loggerResult = addModule({
        moduleId: 'logger',
        targetRoot: projectRoot,
        packageRoot,
      });
      assert.equal(loggerResult.applied, true);

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      const loadMatch = appModule.match(/load: \[([^\]]+)\]/);
      assert.ok(loadMatch);
      assert.match(loadMatch[1], /coreConfig/);
      assert.match(loadMatch[1], /dbPrismaConfig/);
      assert.match(loadMatch[1], /i18nConfig/);
      assert.match(loadMatch[1], /swaggerConfig/);
      assert.match(loadMatch[1], /loggerConfig/);

      const validateMatch = appModule.match(/validate: createEnvValidator\(\[([^\]]+)\]\)/);
      assert.ok(validateMatch);
      assert.match(validateMatch[1], /coreEnvSchema/);
      assert.match(validateMatch[1], /dbPrismaEnvSchema/);
      assert.match(validateMatch[1], /i18nEnvSchema/);
      assert.match(validateMatch[1], /swaggerEnvSchema/);
      assert.match(validateMatch[1], /loggerEnvSchema/);
      assert.match(appModule, /ForgeonSwaggerModule/);
      assert.match(appModule, /ForgeonLoggerModule/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies i18n after logger without losing logger config keys', () => {
    const targetRoot = mkTmp('forgeon-module-logger-i18n-');
    const projectRoot = path.join(targetRoot, 'demo-logger-i18n');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-logger-i18n',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      addModule({
        moduleId: 'logger',
        targetRoot: projectRoot,
        packageRoot,
      });

      const i18nResult = addModule({
        moduleId: 'i18n',
        targetRoot: projectRoot,
        packageRoot,
      });
      assert.equal(i18nResult.applied, true);

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      assert.match(
        appModule,
        /load: \[coreConfig,\s*dbPrismaConfig,\s*loggerConfig,\s*i18nConfig\]/,
      );
      assert.match(
        appModule,
        /validate: createEnvValidator\(\[coreEnvSchema,\s*dbPrismaEnvSchema,\s*loggerEnvSchema,\s*i18nEnvSchema\]\)/,
      );
      assert.match(appModule, /ForgeonLoggerModule/);
      assert.match(appModule, /ForgeonI18nModule/);

      const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
      assert.match(apiPackage, /@forgeon\/logger/);
      assert.match(apiPackage, /@forgeon\/i18n/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/logger build/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/i18n build/);

      const mainTs = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'main.ts'), 'utf8');
      assert.match(mainTs, /ForgeonLoggerService/);
      assert.match(mainTs, /ForgeonHttpLoggingInterceptor/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies i18n after swagger without losing swagger config keys', () => {
    const targetRoot = mkTmp('forgeon-module-swagger-i18n-order-');
    const projectRoot = path.join(targetRoot, 'demo-swagger-i18n-order');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-swagger-i18n-order',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      addModule({
        moduleId: 'swagger',
        targetRoot: projectRoot,
        packageRoot,
      });

      const i18nResult = addModule({
        moduleId: 'i18n',
        targetRoot: projectRoot,
        packageRoot,
      });
      assert.equal(i18nResult.applied, true);

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      assert.match(
        appModule,
        /load: \[coreConfig,\s*dbPrismaConfig,\s*swaggerConfig,\s*i18nConfig\]/,
      );
      assert.match(
        appModule,
        /validate: createEnvValidator\(\[coreEnvSchema,\s*dbPrismaEnvSchema,\s*swaggerEnvSchema,\s*i18nEnvSchema\]\)/,
      );
      assert.match(appModule, /ForgeonSwaggerModule/);
      assert.match(appModule, /ForgeonI18nModule/);

      const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
      assert.match(apiPackage, /@forgeon\/swagger/);
      assert.match(apiPackage, /@forgeon\/i18n/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/swagger build/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/i18n build/);

      const mainTs = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'main.ts'), 'utf8');
      assert.match(mainTs, /setupSwagger/);
      assert.match(mainTs, /SwaggerConfigService/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies swagger -> logger -> i18n and keeps all module wiring', () => {
    const targetRoot = mkTmp('forgeon-module-mixed-order-');
    const projectRoot = path.join(targetRoot, 'demo-mixed-order');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-mixed-order',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      addModule({ moduleId: 'swagger', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'logger', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'i18n', targetRoot: projectRoot, packageRoot });

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      assert.match(
        appModule,
        /load: \[coreConfig,\s*dbPrismaConfig,\s*swaggerConfig,\s*loggerConfig,\s*i18nConfig\]/,
      );
      assert.match(
        appModule,
        /validate: createEnvValidator\(\[coreEnvSchema,\s*dbPrismaEnvSchema,\s*swaggerEnvSchema,\s*loggerEnvSchema,\s*i18nEnvSchema\]\)/,
      );
      assert.match(appModule, /ForgeonSwaggerModule/);
      assert.match(appModule, /ForgeonLoggerModule/);
      assert.match(appModule, /ForgeonI18nModule/);

      const mainTs = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'main.ts'), 'utf8');
      assert.match(mainTs, /setupSwagger\(app,\s*swaggerConfigService\)/);
      assert.match(mainTs, /app\.useLogger\(app\.get\(ForgeonLoggerService\)\);/);
      assert.match(mainTs, /app\.useGlobalInterceptors\(app\.get\(ForgeonHttpLoggingInterceptor\)\);/);

      const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
      assert.match(apiPackage, /@forgeon\/swagger/);
      assert.match(apiPackage, /@forgeon\/logger/);
      assert.match(apiPackage, /@forgeon\/i18n/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/swagger build/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/logger build/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/i18n build/);

      assertDbPrismaWiring(projectRoot);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies jwt-auth with db-prisma adapter and wires persistent token store', () => {
    const targetRoot = mkTmp('forgeon-module-jwt-db-');
    const projectRoot = path.join(targetRoot, 'demo-jwt-db');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-jwt-db',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: true,
        proxy: 'caddy',
      });

      const result = addModule({
        moduleId: 'jwt-auth',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assertJwtAuthWiring(projectRoot, true);

      const storeFile = path.join(
        projectRoot,
        'apps',
        'api',
        'src',
        'auth',
        'prisma-auth-refresh-token.store.ts',
      );
      assert.equal(fs.existsSync(storeFile), true);

      const schema = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'prisma', 'schema.prisma'), 'utf8');
      assert.match(schema, /refreshTokenHash/);

      const migrationPath = path.join(
        projectRoot,
        'apps',
        'api',
        'prisma',
        'migrations',
        '0002_auth_refresh_token_hash',
        'migration.sql',
      );
      assert.equal(fs.existsSync(migrationPath), true);

      const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
      assert.match(readme, /refresh token persistence: enabled/);
      assert.match(readme, /0002_auth_refresh_token_hash/);

      const moduleDoc = fs.readFileSync(result.docsPath, 'utf8');
      assert.match(moduleDoc, /Status: implemented/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies jwt-auth without db and prints warning with stateless fallback', () => {
    const targetRoot = mkTmp('forgeon-module-jwt-nodb-');
    const projectRoot = path.join(targetRoot, 'demo-jwt-nodb');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    const originalError = console.error;
    const warnings = [];
    console.error = (...args) => warnings.push(args.join(' '));

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-jwt-nodb',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      stripDbPrismaArtifacts(projectRoot);

      const result = addModule({
        moduleId: 'jwt-auth',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assertJwtAuthWiring(projectRoot, false);
      assert.equal(
        fs.existsSync(path.join(projectRoot, 'apps', 'api', 'src', 'auth', 'prisma-auth-refresh-token.store.ts')),
        false,
      );

      const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
      assert.match(readme, /refresh token persistence: disabled/);
      assert.match(readme, /create-forgeon add db-prisma/);

      assert.equal(warnings.length > 0, true);
      assert.match(warnings.join('\n'), /jwt-auth installed without persistent refresh token store/);
    } finally {
      console.error = originalError;
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('keeps db-prisma wiring across module installation orders', () => {
    const sequences = [
      ['logger', 'swagger', 'i18n'],
      ['swagger', 'i18n', 'logger'],
      ['i18n', 'logger', 'swagger'],
    ];

    for (const sequence of sequences) {
      const targetRoot = mkTmp(`forgeon-module-db-order-${sequence.join('-')}-`);
      const projectRoot = path.join(targetRoot, `demo-db-${sequence.join('-')}`);
      const templateRoot = path.join(packageRoot, 'templates', 'base');

      try {
        scaffoldProject({
          templateRoot,
          packageRoot,
          targetRoot: projectRoot,
          projectName: `demo-db-${sequence.join('-')}`,
          frontend: 'react',
          db: 'prisma',
        dbPrismaEnabled: true,
          i18nEnabled: false,
          proxy: 'caddy',
        });

        for (const moduleId of sequence) {
          addModule({ moduleId, targetRoot: projectRoot, packageRoot });
        }

        assertDbPrismaWiring(projectRoot);
      } finally {
        fs.rmSync(targetRoot, { recursive: true, force: true });
      }
    }
  });

  it('applies db-prisma as final module after other modules', () => {
    const targetRoot = mkTmp('forgeon-module-db-last-');
    const projectRoot = path.join(targetRoot, 'demo-db-last');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-db-last',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      stripDbPrismaArtifacts(projectRoot);

      addModule({ moduleId: 'logger', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'swagger', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'i18n', targetRoot: projectRoot, packageRoot });
      const dbResult = addModule({ moduleId: 'db-prisma', targetRoot: projectRoot, packageRoot });
      assert.equal(dbResult.applied, true);

      assertDbPrismaWiring(projectRoot);

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      assert.match(appModule, /ForgeonLoggerModule/);
      assert.match(appModule, /ForgeonSwaggerModule/);
      assert.match(appModule, /ForgeonI18nModule/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });
});
