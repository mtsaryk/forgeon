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
  const source = path.join(packageRoot, 'templates', 'module-presets', 'swagger', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing swagger preset template: ${source}`);
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
  ensureDependency(packageJson, '@forgeon/swagger', 'workspace:*');
  ensureBuildSteps(packageJson, 'predev', ['pnpm --filter @forgeon/swagger build']);
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
    "import { setupSwagger, SwaggerConfigService } from '@forgeon/swagger';",
  );

  if (!content.includes('const swaggerConfigService = app.get(SwaggerConfigService);')) {
    content = content.replace(
      '  const coreConfigService = app.get(CoreConfigService);',
      `  const coreConfigService = app.get(CoreConfigService);
  const swaggerConfigService = app.get(SwaggerConfigService);`,
    );
  }

  if (!content.includes('setupSwagger(app, swaggerConfigService);')) {
    content = content.replace(
      '  app.useGlobalFilters(app.get(CoreExceptionFilter));',
      `  app.useGlobalFilters(app.get(CoreExceptionFilter));
  setupSwagger(app, swaggerConfigService);`,
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
  if (!content.includes("from '@forgeon/swagger';")) {
    if (content.includes("import { ForgeonLoggerModule, loggerConfig, loggerEnvSchema } from '@forgeon/logger';")) {
      content = ensureLineAfter(
        content,
        "import { ForgeonLoggerModule, loggerConfig, loggerEnvSchema } from '@forgeon/logger';",
        "import { ForgeonSwaggerModule, swaggerConfig, swaggerEnvSchema } from '@forgeon/swagger';",
      );
    } else if (
      content.includes("import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';")
    ) {
      content = ensureLineAfter(
        content,
        "import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';",
        "import { ForgeonSwaggerModule, swaggerConfig, swaggerEnvSchema } from '@forgeon/swagger';",
      );
    } else {
      content = ensureLineAfter(
        content,
        "import { ConfigModule } from '@nestjs/config';",
        "import { ForgeonSwaggerModule, swaggerConfig, swaggerEnvSchema } from '@forgeon/swagger';",
      );
    }
  }

  content = ensureLoadItem(content, 'swaggerConfig');
  content = ensureValidatorSchema(content, 'swaggerEnvSchema');

  content = ensureLineAfter(content, '    CoreErrorsModule,', '    ForgeonSwaggerModule,');

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchApiDockerfile(targetRoot) {
  const dockerfilePath = path.join(targetRoot, 'apps', 'api', 'Dockerfile');
  if (!fs.existsSync(dockerfilePath)) {
    return;
  }

  let content = fs.readFileSync(dockerfilePath, 'utf8').replace(/\r\n/g, '\n');

  const packageAnchor = content.includes('COPY packages/logger/package.json packages/logger/package.json')
    ? 'COPY packages/logger/package.json packages/logger/package.json'
    : content.includes('COPY packages/db-prisma/package.json packages/db-prisma/package.json')
      ? 'COPY packages/db-prisma/package.json packages/db-prisma/package.json'
      : 'COPY packages/core/package.json packages/core/package.json';
  content = ensureLineAfter(
    content,
    packageAnchor,
    'COPY packages/swagger/package.json packages/swagger/package.json',
  );

  const sourceAnchor = content.includes('COPY packages/logger packages/logger')
    ? 'COPY packages/logger packages/logger'
    : content.includes('COPY packages/db-prisma packages/db-prisma')
      ? 'COPY packages/db-prisma packages/db-prisma'
      : 'COPY packages/core packages/core';
  content = ensureLineAfter(content, sourceAnchor, 'COPY packages/swagger packages/swagger');

  content = content.replace(/^RUN pnpm --filter @forgeon\/swagger build\r?\n?/gm, '');
  const buildAnchor = content.includes('RUN pnpm --filter @forgeon/api prisma:generate')
    ? 'RUN pnpm --filter @forgeon/api prisma:generate'
    : 'RUN pnpm --filter @forgeon/api build';
  content = ensureLineBefore(
    content,
    buildAnchor,
    'RUN pnpm --filter @forgeon/swagger build',
  );

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchCompose(targetRoot) {
  const composePath = path.join(targetRoot, 'infra', 'docker', 'compose.yml');
  if (!fs.existsSync(composePath)) {
    return;
  }

  let content = fs.readFileSync(composePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes('SWAGGER_ENABLED: ${SWAGGER_ENABLED}')) {
    const hasDatabaseUrl = /^(\s+DATABASE_URL:.*)$/m.test(content);
    const anchorPattern = hasDatabaseUrl ? /^(\s+DATABASE_URL:.*)$/m : /^(\s+API_PREFIX:.*)$/m;
    content = content.replace(
      anchorPattern,
      `$1
      SWAGGER_ENABLED: \${SWAGGER_ENABLED}
      SWAGGER_PATH: \${SWAGGER_PATH}
      SWAGGER_TITLE: \${SWAGGER_TITLE}
      SWAGGER_VERSION: \${SWAGGER_VERSION}`,
    );
  }

  fs.writeFileSync(composePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const marker = '## Swagger / OpenAPI Module';
  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  if (content.includes(marker)) {
    return;
  }

  const section = `## Swagger / OpenAPI Module

The swagger add-module provides generated OpenAPI docs for the API.

Configuration (env):
- \`SWAGGER_ENABLED=false\`
- \`SWAGGER_PATH=docs\`
- \`SWAGGER_TITLE="Forgeon API"\`
- \`SWAGGER_VERSION=1.0.0\`

When enabled:
- UI endpoint: \`http://localhost:3000/api/docs\` (respects global API prefix)
- in Docker with proxy: \`http://localhost:8080/api/docs\`
`;

  if (content.includes('## Prisma In Docker Start')) {
    content = content.replace('## Prisma In Docker Start', `${section}\n## Prisma In Docker Start`);
  } else {
    content = `${content.trimEnd()}\n\n${section}\n`;
  }

  fs.writeFileSync(readmePath, `${content.trimEnd()}\n`, 'utf8');
}

export function applySwaggerModule({ packageRoot, targetRoot }) {
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'swagger'));
  patchApiPackage(targetRoot);
  patchMain(targetRoot);
  patchAppModule(targetRoot);
  patchApiDockerfile(targetRoot);
  patchCompose(targetRoot);
  patchReadme(targetRoot);

  upsertEnvLines(path.join(targetRoot, 'apps', 'api', '.env.example'), [
    'SWAGGER_ENABLED=false',
    'SWAGGER_PATH=docs',
    'SWAGGER_TITLE="Forgeon API"',
    'SWAGGER_VERSION=1.0.0',
  ]);
  upsertEnvLines(path.join(targetRoot, 'infra', 'docker', '.env.example'), [
    'SWAGGER_ENABLED=false',
    'SWAGGER_PATH=docs',
    'SWAGGER_TITLE="Forgeon API"',
    'SWAGGER_VERSION=1.0.0',
  ]);
}
