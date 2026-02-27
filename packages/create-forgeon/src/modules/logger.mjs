import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive, writeJson } from '../utils/fs.mjs';

function copyFromPreset(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'module-presets', 'logger', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing logger preset template: ${source}`);
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
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  const loggerBuild = 'pnpm --filter @forgeon/logger build';
  const currentPredev = packageJson.scripts.predev;
  if (typeof currentPredev === 'string') {
    if (!currentPredev.includes(loggerBuild)) {
      if (currentPredev.includes('pnpm --filter @forgeon/core build')) {
        packageJson.scripts.predev = currentPredev.replace(
          'pnpm --filter @forgeon/core build',
          `pnpm --filter @forgeon/core build && ${loggerBuild}`,
        );
      } else {
        packageJson.scripts.predev = `${loggerBuild} && ${currentPredev}`;
      }
    }
  } else {
    packageJson.scripts.predev = loggerBuild;
  }

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
