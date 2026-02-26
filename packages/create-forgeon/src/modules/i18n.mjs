import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive, writeJson } from '../utils/fs.mjs';

function copyFromBase(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'base', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing i18n source template: ${source}`);
  }
  const destination = path.join(targetRoot, relativePath);
  copyRecursive(source, destination);
}

function copyFromPreset(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'module-presets', 'i18n', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing i18n preset template: ${source}`);
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

function patchApiDockerfile(targetRoot) {
  const dockerfilePath = path.join(targetRoot, 'apps', 'api', 'Dockerfile');
  if (!fs.existsSync(dockerfilePath)) {
    return;
  }

  let content = fs.readFileSync(dockerfilePath, 'utf8').replace(/\r\n/g, '\n');
  content = content.replace(
    /^COPY package\.json pnpm-workspace\.yaml tsconfig\.base\.json \.\/$/m,
    'COPY package.json pnpm-workspace.yaml tsconfig.base.json tsconfig.base.node.json tsconfig.base.esm.json ./',
  );

  content = ensureLineAfter(
    content,
    'COPY packages/core/package.json packages/core/package.json',
    'COPY packages/db-prisma/package.json packages/db-prisma/package.json',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/db-prisma/package.json packages/db-prisma/package.json',
    'COPY packages/i18n-contracts/package.json packages/i18n-contracts/package.json',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/i18n-contracts/package.json packages/i18n-contracts/package.json',
    'COPY packages/i18n/package.json packages/i18n/package.json',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/core packages/core',
    'COPY packages/db-prisma packages/db-prisma',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/db-prisma packages/db-prisma',
    'COPY packages/i18n-contracts packages/i18n-contracts',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/i18n-contracts packages/i18n-contracts',
    'COPY packages/i18n packages/i18n',
  );

  content = content
    .replace(/^RUN pnpm --filter @forgeon\/core build\r?\n?/gm, '')
    .replace(/^RUN pnpm --filter @forgeon\/db-prisma build\r?\n?/gm, '')
    .replace(/^RUN pnpm --filter @forgeon\/i18n-contracts build\r?\n?/gm, '')
    .replace(/^RUN pnpm --filter @forgeon\/i18n build\r?\n?/gm, '');

  content = ensureLineBefore(
    content,
    'RUN pnpm --filter @forgeon/api prisma:generate',
    'RUN pnpm --filter @forgeon/core build',
  );
  content = ensureLineBefore(
    content,
    'RUN pnpm --filter @forgeon/api prisma:generate',
    'RUN pnpm --filter @forgeon/db-prisma build',
  );
  content = ensureLineBefore(
    content,
    'RUN pnpm --filter @forgeon/api prisma:generate',
    'RUN pnpm --filter @forgeon/i18n-contracts build',
  );
  content = ensureLineBefore(
    content,
    'RUN pnpm --filter @forgeon/api prisma:generate',
    'RUN pnpm --filter @forgeon/i18n build',
  );

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchProxyDockerfile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

  content = ensureLineAfter(
    content,
    'COPY package.json pnpm-workspace.yaml ./',
    'COPY tsconfig.base.json ./',
  );
  content = ensureLineAfter(
    content,
    'COPY tsconfig.base.json ./',
    'COPY tsconfig.base.node.json ./',
  );
  content = ensureLineAfter(
    content,
    'COPY tsconfig.base.node.json ./',
    'COPY tsconfig.base.esm.json ./',
  );
  content = ensureLineAfter(
    content,
    'COPY apps/web/package.json apps/web/package.json',
    'COPY packages/i18n-contracts/package.json packages/i18n-contracts/package.json',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/i18n-contracts/package.json packages/i18n-contracts/package.json',
    'COPY packages/i18n-web/package.json packages/i18n-web/package.json',
  );
  content = ensureLineAfter(
    content,
    'COPY apps/web apps/web',
    'COPY packages/i18n-contracts packages/i18n-contracts',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/i18n-contracts packages/i18n-contracts',
    'COPY packages/i18n-web packages/i18n-web',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/i18n-web packages/i18n-web',
    'COPY resources resources',
  );

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchProxyDockerfiles(targetRoot) {
  patchProxyDockerfile(path.join(targetRoot, 'infra', 'docker', 'caddy.Dockerfile'));
  patchProxyDockerfile(path.join(targetRoot, 'infra', 'docker', 'nginx.Dockerfile'));
}

function patchCompose(targetRoot) {
  const composePath = path.join(targetRoot, 'infra', 'docker', 'compose.yml');
  if (!fs.existsSync(composePath)) {
    return;
  }

  let content = fs.readFileSync(composePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes('I18N_DEFAULT_LANG: ${I18N_DEFAULT_LANG}')) {
    content = content.replace(
      /^(\s+DATABASE_URL:.*)$/m,
      `$1
      I18N_DEFAULT_LANG: \${I18N_DEFAULT_LANG}
      I18N_FALLBACK_LANG: \${I18N_FALLBACK_LANG}`,
    );
  }

  fs.writeFileSync(composePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchApiPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'apps', 'api', 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  ensureBuildSteps(packageJson, 'predev', [
    'pnpm --filter @forgeon/core build',
    'pnpm --filter @forgeon/db-prisma build',
    'pnpm --filter @forgeon/i18n-contracts build',
    'pnpm --filter @forgeon/i18n build',
  ]);
  ensureDependency(packageJson, '@forgeon/i18n', 'workspace:*');
  ensureDependency(packageJson, '@forgeon/i18n-contracts', 'workspace:*');
  ensureDependency(packageJson, '@forgeon/db-prisma', 'workspace:*');
  ensureDependency(packageJson, 'nestjs-i18n', '^10.5.1');
  writeJson(packagePath, packageJson);
}

function patchWebPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'apps', 'web', 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  ensureBuildSteps(packageJson, 'predev', [
    'pnpm --filter @forgeon/i18n-contracts build',
    'pnpm --filter @forgeon/i18n-web build',
  ]);
  ensureBuildSteps(packageJson, 'prebuild', [
    'pnpm --filter @forgeon/i18n-contracts build',
    'pnpm --filter @forgeon/i18n-web build',
  ]);
  ensureDependency(packageJson, '@forgeon/i18n-contracts', 'workspace:*');
  ensureDependency(packageJson, '@forgeon/i18n-web', 'workspace:*');
  ensureDependency(packageJson, 'i18next', '^23.16.8');
  ensureDependency(packageJson, 'react-i18next', '^15.1.2');
  writeJson(packagePath, packageJson);
}

function patchAppModule(targetRoot) {
  const appModulePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  if (!fs.existsSync(appModulePath)) {
    return;
  }

  let content = fs.readFileSync(appModulePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes("from '@forgeon/i18n';")) {
    if (content.includes("import { ForgeonLoggerModule, loggerConfig, loggerEnvSchema } from '@forgeon/logger';")) {
      content = ensureLineAfter(
        content,
        "import { ForgeonLoggerModule, loggerConfig, loggerEnvSchema } from '@forgeon/logger';",
        "import { ForgeonI18nModule, i18nConfig, i18nEnvSchema } from '@forgeon/i18n';",
      );
    } else if (
      content.includes("import { ForgeonSwaggerModule, swaggerConfig, swaggerEnvSchema } from '@forgeon/swagger';")
    ) {
      content = ensureLineAfter(
        content,
        "import { ForgeonSwaggerModule, swaggerConfig, swaggerEnvSchema } from '@forgeon/swagger';",
        "import { ForgeonI18nModule, i18nConfig, i18nEnvSchema } from '@forgeon/i18n';",
      );
    } else if (
      content.includes("import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';")
    ) {
      content = ensureLineAfter(
        content,
        "import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';",
        "import { ForgeonI18nModule, i18nConfig, i18nEnvSchema } from '@forgeon/i18n';",
      );
    } else {
      content = ensureLineAfter(
        content,
        "import { ConfigModule } from '@nestjs/config';",
        "import { ForgeonI18nModule, i18nConfig, i18nEnvSchema } from '@forgeon/i18n';",
      );
    }
  }

  if (!content.includes("import { join } from 'path';")) {
    content = ensureLineBefore(
      content,
      "import { HealthController } from './health/health.controller';",
      "import { join } from 'path';",
    );
  }

  if (!content.includes('const i18nPath =')) {
    content = ensureLineBefore(
      content,
      '@Module({',
      "const i18nPath = join(__dirname, '..', '..', '..', 'resources', 'i18n');",
    );
  }

  content = ensureLoadItem(content, 'i18nConfig');
  content = ensureValidatorSchema(content, 'i18nEnvSchema');

  const i18nModuleBlock = `    ForgeonI18nModule.register({
      path: i18nPath,
    }),`;
  if (!content.includes('ForgeonI18nModule.register({')) {
    if (content.includes('    DbPrismaModule,')) {
      content = ensureLineAfter(content, '    DbPrismaModule,', i18nModuleBlock);
    } else if (content.includes('    ForgeonLoggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonLoggerModule,', i18nModuleBlock);
    } else if (content.includes('    ForgeonSwaggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonSwaggerModule,', i18nModuleBlock);
    } else {
      content = ensureLineAfter(content, '    CoreErrorsModule,', i18nModuleBlock);
    }
  }

  fs.writeFileSync(appModulePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchHealthController(targetRoot) {
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes("from 'nestjs-i18n';")) {
    if (content.includes("import { PrismaService } from '@forgeon/db-prisma';")) {
      content = ensureLineAfter(
        content,
        "import { PrismaService } from '@forgeon/db-prisma';",
        "import { I18nService } from 'nestjs-i18n';",
      );
    } else {
      content = ensureLineAfter(
        content,
        "import { BadRequestException, ConflictException, Controller, Get, Post, Query } from '@nestjs/common';",
        "import { I18nService } from 'nestjs-i18n';",
      );
    }
  }

  if (!content.includes('private readonly i18n: I18nService')) {
    const constructorMatch = content.match(/constructor\(([\s\S]*?)\)\s*\{/m);
    if (constructorMatch) {
      const original = constructorMatch[0];
      const inner = constructorMatch[1].trimEnd();
      const separator = inner.length > 0 ? ',' : '';
      const next = `constructor(${inner}${separator}
    private readonly i18n: I18nService,
  ) {`;
      content = content.replace(original, next);
    }
  }

  if (!content.includes('private translate(')) {
    const translateMethod = `
  private translate(key: string, lang?: string): string {
    const value = this.i18n.t(key, { lang, defaultValue: key });
    return typeof value === 'string' ? value : key;
  }
`;
    content = `${content.trimEnd()}\n${translateMethod}\n`;
  }

  content = content.replace(
    /getHealth\(@Query\('lang'\)\s*_lang\?:\s*string\)/g,
    "getHealth(@Query('lang') lang?: string)",
  );
  content = content.replace(
    /getErrorProbe\(\)/g,
    "getErrorProbe(@Query('lang') lang?: string)",
  );
  content = content.replace(
    /getValidationProbe\(@Query\('value'\)\s*value\?:\s*string\)/g,
    "getValidationProbe(@Query('value') value?: string, @Query('lang') lang?: string)",
  );
  content = content.replace(/message:\s*'OK',/g, "message: this.translate('common.actions.ok', lang),");
  content = content.replace(/i18n:\s*'English',/g, "i18n: 'en',");

  content = content.replace(
    /message:\s*'Email already exists',/g,
    "message: this.translate('errors.http.CONFLICT', lang),",
  );

  if (
    content.includes("const translatedMessage = this.translate('validation.generic.required', lang);") === false &&
    content.includes("if (!value || value.trim().length === 0) {")
  ) {
    content = content.replace(
      /if \(!value \|\| value\.trim\(\)\.length === 0\) \{\s*throw new BadRequestException\(\{\s*message:\s*'Field is required',\s*details:\s*\[\{ field: 'value', message: 'Field is required' \}\],\s*\}\);\s*\}/m,
      `if (!value || value.trim().length === 0) {
      const translatedMessage = this.translate('validation.generic.required', lang);
      throw new BadRequestException({
        message: translatedMessage,
        details: [{ field: 'value', message: translatedMessage }],
      });
    }`,
    );
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchI18nPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'packages', 'i18n', 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  ensureDependency(packageJson, '@forgeon/i18n-contracts', 'workspace:*');
  writeJson(packagePath, packageJson);
}

function patchRootPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  ensureScript(
    packageJson,
    'i18n:sync',
    'pnpm --filter @forgeon/i18n-contracts i18n:sync',
  );
  ensureScript(
    packageJson,
    'i18n:check',
    'pnpm --filter @forgeon/i18n-contracts i18n:check',
  );
  ensureScript(
    packageJson,
    'i18n:types',
    'pnpm --filter @forgeon/i18n-contracts i18n:types',
  );
  ensureScript(packageJson, 'i18n:add', 'node scripts/i18n-add.mjs');
  writeJson(packagePath, packageJson);
}

export function applyI18nModule({ packageRoot, targetRoot }) {
  copyFromBase(packageRoot, targetRoot, path.join('scripts', 'i18n-add.mjs'));
  copyFromBase(packageRoot, targetRoot, path.join('packages', 'db-prisma'));
  copyFromBase(packageRoot, targetRoot, path.join('packages', 'i18n'));
  copyFromBase(packageRoot, targetRoot, path.join('resources', 'i18n'));

  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'i18n-contracts'));
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'i18n-web'));
  copyFromPreset(packageRoot, targetRoot, path.join('apps', 'web', 'src', 'App.tsx'));
  copyFromPreset(packageRoot, targetRoot, path.join('apps', 'web', 'src', 'i18n.ts'));
  copyFromPreset(packageRoot, targetRoot, path.join('apps', 'web', 'src', 'main.tsx'));

  patchI18nPackage(targetRoot);
  patchApiPackage(targetRoot);
  patchWebPackage(targetRoot);
  patchRootPackage(targetRoot);
  patchAppModule(targetRoot);
  patchHealthController(targetRoot);
  patchApiDockerfile(targetRoot);
  patchProxyDockerfiles(targetRoot);

  upsertEnvLines(path.join(targetRoot, 'apps', 'api', '.env.example'), [
    'I18N_DEFAULT_LANG=en',
    'I18N_FALLBACK_LANG=en',
  ]);
  upsertEnvLines(path.join(targetRoot, 'infra', 'docker', '.env.example'), [
    'I18N_DEFAULT_LANG=en',
    'I18N_FALLBACK_LANG=en',
  ]);

  patchCompose(targetRoot);
}
