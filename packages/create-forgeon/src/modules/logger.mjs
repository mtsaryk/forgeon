import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive, writeJson } from '../utils/fs.mjs';
import {
  ensureBuildSteps,
  ensureDependency,
  ensureLineAfter,
  ensureLineBefore,
  ensureLoadItem,
  ensureValidatorSchema,
  upsertEnvLines,
} from './shared/patch-utils.mjs';

function copyFromPreset(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'module-presets', 'logger', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing logger preset template: ${source}`);
  }
  const destination = path.join(targetRoot, relativePath);
  copyRecursive(source, destination);
}

function patchApiPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'apps', 'api', 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  ensureBuildSteps(packageJson, 'predev', ['pnpm --filter @forgeon/logger build']);

  ensureDependency(packageJson, '@forgeon/logger', 'workspace:*');
  writeJson(packagePath, packageJson);
}

function patchMain(targetRoot) {
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'main.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  content = ensureLineBefore(
    content,
    "import { NestFactory } from '@nestjs/core';",
    "import { ForgeonHttpLoggingInterceptor, ForgeonLoggerService } from '@forgeon/logger';",
  );

  content = content.replace(
    'const app = await NestFactory.create(AppModule);',
    'const app = await NestFactory.create(AppModule, { bufferLogs: true });',
  );

  if (!content.includes('app.useLogger(app.get(ForgeonLoggerService));')) {
    content = content.replace(
      '  const coreConfigService = app.get(CoreConfigService);',
      `  const coreConfigService = app.get(CoreConfigService);
  app.useLogger(app.get(ForgeonLoggerService));
  app.useGlobalInterceptors(app.get(ForgeonHttpLoggingInterceptor));`,
    );
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchAppModule(targetRoot) {
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

  if (!content.includes("from '@forgeon/logger';")) {
    if (content.includes("import { ForgeonSwaggerModule, swaggerConfig, swaggerEnvSchema } from '@forgeon/swagger';")) {
      content = ensureLineAfter(
        content,
        "import { ForgeonSwaggerModule, swaggerConfig, swaggerEnvSchema } from '@forgeon/swagger';",
        "import { ForgeonLoggerModule, loggerConfig, loggerEnvSchema } from '@forgeon/logger';",
      );
    } else if (
      content.includes("import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';")
    ) {
      content = ensureLineAfter(
        content,
        "import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';",
        "import { ForgeonLoggerModule, loggerConfig, loggerEnvSchema } from '@forgeon/logger';",
      );
    } else {
      content = ensureLineAfter(
        content,
        "import { ConfigModule } from '@nestjs/config';",
        "import { ForgeonLoggerModule, loggerConfig, loggerEnvSchema } from '@forgeon/logger';",
      );
    }
  }

  content = ensureLoadItem(content, 'loggerConfig');
  content = ensureValidatorSchema(content, 'loggerEnvSchema');

  content = ensureLineAfter(content, '    CoreErrorsModule,', '    ForgeonLoggerModule,');

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchApiDockerfile(targetRoot) {
  const dockerfilePath = path.join(targetRoot, 'apps', 'api', 'Dockerfile');
  if (!fs.existsSync(dockerfilePath)) {
    return;
  }

  let content = fs.readFileSync(dockerfilePath, 'utf8').replace(/\r\n/g, '\n');

  const packageAnchor = content.includes('COPY packages/db-prisma/package.json packages/db-prisma/package.json')
    ? 'COPY packages/db-prisma/package.json packages/db-prisma/package.json'
    : 'COPY packages/core/package.json packages/core/package.json';
  content = ensureLineAfter(
    content,
    packageAnchor,
    'COPY packages/logger/package.json packages/logger/package.json',
  );

  const sourceAnchor = content.includes('COPY packages/db-prisma packages/db-prisma')
    ? 'COPY packages/db-prisma packages/db-prisma'
    : 'COPY packages/core packages/core';
  content = ensureLineAfter(content, sourceAnchor, 'COPY packages/logger packages/logger');

  content = content.replace(/^RUN pnpm --filter @forgeon\/logger build\r?\n?/gm, '');
  const buildAnchor = content.includes('RUN pnpm --filter @forgeon/api prisma:generate')
    ? 'RUN pnpm --filter @forgeon/api prisma:generate'
    : 'RUN pnpm --filter @forgeon/api build';
  content = ensureLineBefore(
    content,
    buildAnchor,
    'RUN pnpm --filter @forgeon/logger build',
  );

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchCompose(targetRoot) {
  const composePath = path.join(targetRoot, 'infra', 'docker', 'compose.yml');
  if (!fs.existsSync(composePath)) {
    return;
  }

  let content = fs.readFileSync(composePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes('LOGGER_LEVEL: ${LOGGER_LEVEL}')) {
    content = content.replace(
      /^(\s+API_PREFIX:.*)$/m,
      `$1
      LOGGER_LEVEL: \${LOGGER_LEVEL}
      LOGGER_HTTP_ENABLED: \${LOGGER_HTTP_ENABLED}
      LOGGER_REQUEST_ID_HEADER: \${LOGGER_REQUEST_ID_HEADER}`,
    );
  }

  fs.writeFileSync(composePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const marker = '## Logger Module';
  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  if (content.includes(marker)) {
    return;
  }

  const section = `## Logger Module

The logger add-module provides:
- request id middleware (default header: \`x-request-id\`)
- HTTP access logs with method/path/status/duration/ip/requestId
- Nest logger integration via \`app.useLogger(...)\`

Configuration (env):
- \`LOGGER_LEVEL=log\` (\`error|warn|log|debug|verbose\`)
- \`LOGGER_HTTP_ENABLED=true\`
- \`LOGGER_REQUEST_ID_HEADER=x-request-id\`

Where to see logs:
- local dev: API terminal output
- Docker: \`docker compose logs api\`
`;

  if (content.includes('## Prisma In Docker Start')) {
    content = content.replace('## Prisma In Docker Start', `${section}\n## Prisma In Docker Start`);
  } else {
    content = `${content.trimEnd()}\n\n${section}\n`;
  }

  fs.writeFileSync(readmePath, `${content.trimEnd()}\n`, 'utf8');
}

export function applyLoggerModule({ packageRoot, targetRoot }) {
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'logger'));
  patchApiPackage(targetRoot);
  patchMain(targetRoot);
  patchAppModule(targetRoot);
  patchApiDockerfile(targetRoot);
  patchCompose(targetRoot);
  patchReadme(targetRoot);

  upsertEnvLines(path.join(targetRoot, 'apps', 'api', '.env.example'), [
    'LOGGER_LEVEL=log',
    'LOGGER_HTTP_ENABLED=true',
    'LOGGER_REQUEST_ID_HEADER=x-request-id',
  ]);

  upsertEnvLines(path.join(targetRoot, 'infra', 'docker', '.env.example'), [
    'LOGGER_LEVEL=log',
    'LOGGER_HTTP_ENABLED=true',
    'LOGGER_REQUEST_ID_HEADER=x-request-id',
  ]);
}
