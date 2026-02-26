import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive, writeJson } from '../utils/fs.mjs';

function copyFromBase(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'base', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing db-prisma source template: ${source}`);
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

function ensureDevDependency(packageJson, name, version) {
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }
  packageJson.devDependencies[name] = version;
}

function ensureScript(packageJson, name, command) {
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  packageJson.scripts[name] = command;
}

function ensureBuildSteps(packageJson, scriptName, requiredCommands) {
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  const current = packageJson.scripts[scriptName];
  const steps =
    typeof current === 'string' && current.trim().length > 0
      ? current
          .split('&&')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  for (const command of requiredCommands) {
    if (!steps.includes(command)) {
      steps.push(command);
    }
  }

  if (steps.length > 0) {
    packageJson.scripts[scriptName] = steps.join(' && ');
  }
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
  ensureDependency(packageJson, '@forgeon/db-prisma', 'workspace:*');
  ensureDependency(packageJson, '@prisma/client', '^6.18.0');
  ensureDevDependency(packageJson, 'prisma', '^6.18.0');

  ensureBuildSteps(packageJson, 'predev', ['pnpm --filter @forgeon/db-prisma build']);
  ensureScript(packageJson, 'prisma:generate', 'prisma generate --schema prisma/schema.prisma');
  ensureScript(packageJson, 'prisma:migrate:dev', 'prisma migrate dev --schema prisma/schema.prisma');
  ensureScript(
    packageJson,
    'prisma:migrate:deploy',
    'prisma migrate deploy --schema prisma/schema.prisma',
  );
  ensureScript(packageJson, 'prisma:studio', 'prisma studio --schema prisma/schema.prisma');
  ensureScript(packageJson, 'prisma:seed', 'ts-node --transpile-only prisma/seed.ts');

  if (!packageJson.prisma || typeof packageJson.prisma !== 'object') {
    packageJson.prisma = {};
  }
  packageJson.prisma.seed = 'ts-node --transpile-only prisma/seed.ts';

  writeJson(packagePath, packageJson);
}

function patchRootPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  const command = 'pnpm --filter @forgeon/api prisma:generate';
  const current = packageJson.scripts.postinstall;
  if (typeof current !== 'string' || current.trim().length === 0) {
    packageJson.scripts.postinstall = command;
  } else if (!current.includes(command)) {
    packageJson.scripts.postinstall = `${current} && ${command}`;
  }

  writeJson(packagePath, packageJson);
}

function patchAppModule(targetRoot) {
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes("from '@forgeon/db-prisma';")) {
    content = ensureLineAfter(
      content,
      "import { ConfigModule } from '@nestjs/config';",
      "import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';",
    );
  }

  content = ensureLoadItem(content, 'dbPrismaConfig');
  content = ensureValidatorSchema(content, 'dbPrismaEnvSchema');

  if (!content.includes('    DbPrismaModule,')) {
    if (content.includes('    ForgeonI18nModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonI18nModule.register({', '    DbPrismaModule,');
    } else if (content.includes('    ForgeonLoggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonLoggerModule,', '    DbPrismaModule,');
    } else if (content.includes('    ForgeonSwaggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonSwaggerModule,', '    DbPrismaModule,');
    } else {
      content = ensureLineAfter(content, '    CoreErrorsModule,', '    DbPrismaModule,');
    }
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchHealthController(targetRoot) {
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes("from '@forgeon/db-prisma';")) {
    const anchor = content.includes("import { I18nService } from 'nestjs-i18n';")
      ? "import { I18nService } from 'nestjs-i18n';"
      : "import { BadRequestException, ConflictException, Controller, Get, Post, Query } from '@nestjs/common';";
    content = ensureLineAfter(content, anchor, "import { PrismaService } from '@forgeon/db-prisma';");
  }

  if (!content.includes('private readonly prisma: PrismaService')) {
    const constructorMatch = content.match(/constructor\(([\s\S]*?)\)\s*\{/m);
    if (constructorMatch) {
      const original = constructorMatch[0];
      const inner = constructorMatch[1].trimEnd();
      const separator = inner.length > 0 ? ',' : '';
      const next = `constructor(${inner}${separator}
    private readonly prisma: PrismaService,
  ) {`;
      content = content.replace(original, next);
    }
  }

  if (!content.includes("@Post('db')")) {
    const dbMethod = `
  @Post('db')
  async getDbProbe() {
    const token = \`\${Date.now()}-\${Math.floor(Math.random() * 1_000_000)}\`;
    const email = \`health-probe-\${token}@example.local\`;
    const user = await this.prisma.user.create({
      data: { email },
      select: { id: true, email: true, createdAt: true },
    });

    return {
      status: 'ok',
      feature: 'db-prisma',
      user,
    };
  }
`;
    const translateIndex = content.indexOf('private translate(');
    if (translateIndex > -1) {
      content = `${content.slice(0, translateIndex).trimEnd()}\n\n${dbMethod}\n${content.slice(translateIndex)}`;
    } else {
      content = `${content.trimEnd()}\n${dbMethod}\n`;
    }
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchApiDockerfile(targetRoot) {
  const dockerfilePath = path.join(targetRoot, 'apps', 'api', 'Dockerfile');
  if (!fs.existsSync(dockerfilePath)) {
    return;
  }

  let content = fs.readFileSync(dockerfilePath, 'utf8').replace(/\r\n/g, '\n');
  content = ensureLineAfter(
    content,
    'COPY apps/api/package.json apps/api/package.json',
    'COPY apps/api/prisma apps/api/prisma',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/core/package.json packages/core/package.json',
    'COPY packages/db-prisma/package.json packages/db-prisma/package.json',
  );
  content = ensureLineAfter(content, 'COPY packages/core packages/core', 'COPY packages/db-prisma packages/db-prisma');

  content = content.replace(/^RUN pnpm --filter @forgeon\/db-prisma build\r?\n?/gm, '');
  content = ensureLineBefore(
    content,
    'RUN pnpm --filter @forgeon/api prisma:generate',
    'RUN pnpm --filter @forgeon/db-prisma build',
  );

  if (!content.includes('RUN pnpm --filter @forgeon/api prisma:generate')) {
    content = ensureLineBefore(
      content,
      'RUN pnpm --filter @forgeon/api build',
      'RUN pnpm --filter @forgeon/api prisma:generate',
    );
  }

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchCompose(targetRoot) {
  const composePath = path.join(targetRoot, 'infra', 'docker', 'compose.yml');
  if (!fs.existsSync(composePath)) {
    return;
  }

  let content = fs.readFileSync(composePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes('DATABASE_URL: ${DATABASE_URL}')) {
    content = content.replace(
      /^(\s+API_PREFIX:.*)$/m,
      `$1
      DATABASE_URL: \${DATABASE_URL}`,
    );
  }

  fs.writeFileSync(composePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const marker = '## DB Prisma Module';
  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  if (content.includes(marker)) {
    return;
  }

  const section = `## DB Prisma Module

The db-prisma add-module provides:
- \`@forgeon/db-prisma\` package wiring
- Prisma scripts in \`apps/api/package.json\`
- DB probe endpoint (\`POST /api/health/db\`)

Configuration (env):
- \`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app?schema=public\`
`;

  if (content.includes('## Prisma In Docker Start')) {
    content = content.replace('## Prisma In Docker Start', `${section}\n## Prisma In Docker Start`);
  } else {
    content = `${content.trimEnd()}\n\n${section}\n`;
  }

  fs.writeFileSync(readmePath, `${content.trimEnd()}\n`, 'utf8');
}

export function applyDbPrismaModule({ packageRoot, targetRoot }) {
  copyFromBase(packageRoot, targetRoot, path.join('packages', 'db-prisma'));
  copyFromBase(packageRoot, targetRoot, path.join('apps', 'api', 'prisma'));

  patchApiPackage(targetRoot);
  patchRootPackage(targetRoot);
  patchAppModule(targetRoot);
  patchHealthController(targetRoot);
  patchApiDockerfile(targetRoot);
  patchCompose(targetRoot);
  patchReadme(targetRoot);

  upsertEnvLines(path.join(targetRoot, 'apps', 'api', '.env.example'), [
    'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app?schema=public',
  ]);
  upsertEnvLines(path.join(targetRoot, 'infra', 'docker', '.env.example'), [
    'DATABASE_URL=postgresql://postgres:postgres@db:5432/app?schema=public',
  ]);
}
