import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive, writeJson } from '../utils/fs.mjs';

function copyFromPreset(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'module-presets', 'swagger', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing swagger preset template: ${source}`);
  }
  const destination = path.join(targetRoot, relativePath);
  copyRecursive(source, destination);
}

function ensureDependency(packageJson, name, version) {
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  packageJson.dependencies[name] = version;
}

function ensureLineAfter(content, anchorLine, lineToInsert) {
  if (content.includes(lineToInsert)) {
    return content;
  }

  const index = content.indexOf(anchorLine);
  if (index < 0) {
    return `${content.trimEnd()}\n${lineToInsert}\n`;
  }

  const insertAt = index + anchorLine.length;
  return `${content.slice(0, insertAt)}\n${lineToInsert}${content.slice(insertAt)}`;
}

function ensureLineBefore(content, anchorLine, lineToInsert) {
  if (content.includes(lineToInsert)) {
    return content;
  }

  const index = content.indexOf(anchorLine);
  if (index < 0) {
    return `${content.trimEnd()}\n${lineToInsert}\n`;
  }

  return `${content.slice(0, index)}${lineToInsert}\n${content.slice(index)}`;
}

function upsertEnvLines(filePath, lines) {
  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  }

  const keys = new Set(
    content
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split('=')[0]),
  );

  const append = [];
  for (const line of lines) {
    const key = line.split('=')[0];
    if (!keys.has(key)) {
      append.push(line);
    }
  }

  const next =
    append.length > 0 ? `${content.trimEnd()}\n${append.join('\n')}\n` : `${content.trimEnd()}\n`;
  fs.writeFileSync(filePath, next.replace(/^\n/, ''), 'utf8');
}

function ensureBuildStep(packageJson, buildCommand) {
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  const current = packageJson.scripts.predev;
  if (typeof current !== 'string' || current.trim().length === 0) {
    packageJson.scripts.predev = buildCommand;
    return;
  }

  if (current.includes(buildCommand)) {
    return;
  }

  packageJson.scripts.predev = `${buildCommand} && ${current}`;
}

function ensureLoadItem(content, itemName) {
  const pattern = /load:\s*\[([^\]]*)\]/m;
  const match = content.match(pattern);
  if (!match) {
    return content;
  }

  const rawList = match[1];
  const items = rawList
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!items.includes(itemName)) {
    items.push(itemName);
  }

  const next = `load: [${items.join(', ')}]`;
  return content.replace(pattern, next);
}

function ensureValidatorSchema(content, schemaName) {
  const pattern = /validate:\s*createEnvValidator\(\[([^\]]*)\]\)/m;
  const match = content.match(pattern);
  if (!match) {
    return content;
  }

  const rawList = match[1];
  const items = rawList
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!items.includes(schemaName)) {
    items.push(schemaName);
  }

  const next = `validate: createEnvValidator([${items.join(', ')}])`;
  return content.replace(pattern, next);
}

function patchApiPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'apps', 'api', 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  ensureDependency(packageJson, '@forgeon/swagger', 'workspace:*');
  ensureBuildStep(packageJson, 'pnpm --filter @forgeon/swagger build');
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
  content = ensureLineBefore(
    content,
    'RUN pnpm --filter @forgeon/api prisma:generate',
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
    content = content.replace(
      /^(\s+DATABASE_URL:.*)$/m,
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
