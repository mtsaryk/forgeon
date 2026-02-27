import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive, writeJson } from '../utils/fs.mjs';

const JWT_README_START = '<!-- forgeon:jwt-auth:start -->';
const JWT_README_END = '<!-- forgeon:jwt-auth:end -->';

function copyFromPreset(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'module-presets', 'jwt-auth', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing jwt-auth preset template: ${source}`);
  }
  const destination = path.join(targetRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  copyRecursive(source, destination);
}

function ensureDependency(packageJson, name, version) {
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  packageJson.dependencies[name] = version;
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

function detectDbAdapter(targetRoot) {
  const apiPackagePath = path.join(targetRoot, 'apps', 'api', 'package.json');
  let deps = {};
  if (fs.existsSync(apiPackagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(apiPackagePath, 'utf8'));
    deps = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    };
  }

  if (
    deps['@forgeon/db-prisma'] ||
    fs.existsSync(path.join(targetRoot, 'packages', 'db-prisma', 'package.json'))
  ) {
    return { id: 'db-prisma', supported: true, tokenStore: 'prisma' };
  }

  const dbDeps = Object.keys(deps).filter((name) => name.startsWith('@forgeon/db-'));
  if (dbDeps.length > 0) {
    return { id: dbDeps[0], supported: false, tokenStore: 'none' };
  }

  const packagesPath = path.join(targetRoot, 'packages');
  if (fs.existsSync(packagesPath)) {
    const localDbPackages = fs
      .readdirSync(packagesPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('db-'))
      .map((entry) => entry.name);
    if (localDbPackages.includes('db-prisma')) {
      return { id: 'db-prisma', supported: true, tokenStore: 'prisma' };
    }
    if (localDbPackages.length > 0) {
      return { id: `@forgeon/${localDbPackages[0]}`, supported: false, tokenStore: 'none' };
    }
  }

  return null;
}

function printDbWarning(message) {
  console.error(`\x1b[31m[create-forgeon add jwt-auth] ${message}\x1b[0m`);
}

function patchApiPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'apps', 'api', 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  ensureDependency(packageJson, '@forgeon/auth-api', 'workspace:*');
  ensureDependency(packageJson, '@forgeon/auth-contracts', 'workspace:*');

  ensureBuildSteps(packageJson, 'predev', [
    'pnpm --filter @forgeon/auth-contracts build',
    'pnpm --filter @forgeon/auth-api build',
  ]);

  writeJson(packagePath, packageJson);
}

function patchAppModule(targetRoot, dbAdapter) {
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  const withPrismaStore = dbAdapter?.supported === true && dbAdapter?.id === 'db-prisma';

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes("from '@forgeon/auth-api';")) {
    if (content.includes("import { ForgeonI18nModule, i18nConfig, i18nEnvSchema } from '@forgeon/i18n';")) {
      content = ensureLineAfter(
        content,
        "import { ForgeonI18nModule, i18nConfig, i18nEnvSchema } from '@forgeon/i18n';",
        "import { AUTH_REFRESH_TOKEN_STORE, authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';",
      );
    } else if (
      content.includes("import { ForgeonLoggerModule, loggerConfig, loggerEnvSchema } from '@forgeon/logger';")
    ) {
      content = ensureLineAfter(
        content,
        "import { ForgeonLoggerModule, loggerConfig, loggerEnvSchema } from '@forgeon/logger';",
        "import { AUTH_REFRESH_TOKEN_STORE, authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';",
      );
    } else if (
      content.includes("import { ForgeonSwaggerModule, swaggerConfig, swaggerEnvSchema } from '@forgeon/swagger';")
    ) {
      content = ensureLineAfter(
        content,
        "import { ForgeonSwaggerModule, swaggerConfig, swaggerEnvSchema } from '@forgeon/swagger';",
        "import { AUTH_REFRESH_TOKEN_STORE, authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';",
      );
    } else if (
      content.includes("import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';")
    ) {
      content = ensureLineAfter(
        content,
        "import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';",
        "import { AUTH_REFRESH_TOKEN_STORE, authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';",
      );
    } else {
      content = ensureLineAfter(
        content,
        "import { ConfigModule } from '@nestjs/config';",
        "import { AUTH_REFRESH_TOKEN_STORE, authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';",
      );
    }
  }

  if (withPrismaStore && !content.includes("./auth/prisma-auth-refresh-token.store")) {
    content = ensureLineBefore(
      content,
      "import { HealthController } from './health/health.controller';",
      "import { PrismaAuthRefreshTokenStore } from './auth/prisma-auth-refresh-token.store';",
    );
  }

  content = ensureLoadItem(content, 'authConfig');
  content = ensureValidatorSchema(content, 'authEnvSchema');

  if (!content.includes('ForgeonAuthModule.register(')) {
    const moduleBlock = withPrismaStore
      ? `    ForgeonAuthModule.register({
      imports: [DbPrismaModule],
      refreshTokenStoreProvider: {
        provide: AUTH_REFRESH_TOKEN_STORE,
        useClass: PrismaAuthRefreshTokenStore,
      },
    }),`
      : `    ForgeonAuthModule.register(),`;

    if (content.includes('    ForgeonI18nModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonI18nModule.register({', moduleBlock);
    } else if (content.includes('    DbPrismaModule,')) {
      content = ensureLineAfter(content, '    DbPrismaModule,', moduleBlock);
    } else if (content.includes('    ForgeonLoggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonLoggerModule,', moduleBlock);
    } else if (content.includes('    ForgeonSwaggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonSwaggerModule,', moduleBlock);
    } else {
      content = ensureLineAfter(content, '    CoreErrorsModule,', moduleBlock);
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

  if (!content.includes("from '@forgeon/auth-api';")) {
    if (content.includes("import { PrismaService } from '@forgeon/db-prisma';")) {
      content = ensureLineAfter(
        content,
        "import { PrismaService } from '@forgeon/db-prisma';",
        "import { AuthService } from '@forgeon/auth-api';",
      );
    } else {
      content = ensureLineAfter(
        content,
        "import { BadRequestException, ConflictException, Controller, Get, Post, Query } from '@nestjs/common';",
        "import { AuthService } from '@forgeon/auth-api';",
      );
    }
  }

  if (!content.includes('private readonly authService: AuthService')) {
    const constructorMatch = content.match(/constructor\(([\s\S]*?)\)\s*\{/m);
    if (constructorMatch) {
      const original = constructorMatch[0];
      const inner = constructorMatch[1].trimEnd();
      const normalizedInner = inner.replace(/,\s*$/, '');
      const separator = normalizedInner.length > 0 ? ',' : '';
      const next = `constructor(${normalizedInner}${separator}
    private readonly authService: AuthService,
  ) {`;
      content = content.replace(original, next);
    }
  }

  if (!content.includes("@Get('auth')")) {
    const method = `
  @Get('auth')
  getAuthProbe() {
    return this.authService.getProbeStatus();
  }
`;
    if (content.includes("@Post('db')")) {
      content = content.replace("@Post('db')", `${method}\n  @Post('db')`);
    } else if (content.includes('private translate(')) {
      const index = content.indexOf('private translate(');
      content = `${content.slice(0, index).trimEnd()}\n\n${method}\n${content.slice(index)}`;
    } else {
      content = `${content.trimEnd()}\n${method}\n`;
    }
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchWebApp(targetRoot) {
  const filePath = path.join(targetRoot, 'apps', 'web', 'src', 'App.tsx');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes('authProbeResult')) {
    content = content.replace(
      '  const [dbProbeResult, setDbProbeResult] = useState<ProbeResult | null>(null);',
      `  const [dbProbeResult, setDbProbeResult] = useState<ProbeResult | null>(null);
  const [authProbeResult, setAuthProbeResult] = useState<ProbeResult | null>(null);`,
    );
  }

  if (!content.includes('Check JWT auth probe')) {
    const path = content.includes("runProbe(setHealthResult, '/health')") ? '/health/auth' : '/api/health/auth';
    content = content.replace(
      /<button onClick=\{\(\) => runProbe\(setErrorProbeResult,[\s\S]*?<\/button>/m,
      (match) =>
        `${match}
        <button onClick={() => runProbe(setAuthProbeResult, '${path}')}>Check JWT auth probe</button>`,
    );
  }

  if (!content.includes("renderResult('Auth probe response', authProbeResult)")) {
    content = content.replace(
      "{renderResult('DB probe response', dbProbeResult)}",
      `{renderResult('DB probe response', dbProbeResult)}
      {renderResult('Auth probe response', authProbeResult)}`,
    );
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchApiDockerfile(targetRoot) {
  const dockerfilePath = path.join(targetRoot, 'apps', 'api', 'Dockerfile');
  if (!fs.existsSync(dockerfilePath)) {
    return;
  }

  let content = fs.readFileSync(dockerfilePath, 'utf8').replace(/\r\n/g, '\n');
  const packageAnchors = [
    'COPY packages/swagger/package.json packages/swagger/package.json',
    'COPY packages/logger/package.json packages/logger/package.json',
    'COPY packages/i18n/package.json packages/i18n/package.json',
    'COPY packages/db-prisma/package.json packages/db-prisma/package.json',
    'COPY packages/core/package.json packages/core/package.json',
  ];
  const packageAnchor = packageAnchors.find((line) => content.includes(line)) ?? packageAnchors.at(-1);
  content = ensureLineAfter(
    content,
    packageAnchor,
    'COPY packages/auth-contracts/package.json packages/auth-contracts/package.json',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/auth-contracts/package.json packages/auth-contracts/package.json',
    'COPY packages/auth-api/package.json packages/auth-api/package.json',
  );

  const sourceAnchors = [
    'COPY packages/swagger packages/swagger',
    'COPY packages/logger packages/logger',
    'COPY packages/i18n packages/i18n',
    'COPY packages/db-prisma packages/db-prisma',
    'COPY packages/core packages/core',
  ];
  const sourceAnchor = sourceAnchors.find((line) => content.includes(line)) ?? sourceAnchors.at(-1);
  content = ensureLineAfter(content, sourceAnchor, 'COPY packages/auth-contracts packages/auth-contracts');
  content = ensureLineAfter(
    content,
    'COPY packages/auth-contracts packages/auth-contracts',
    'COPY packages/auth-api packages/auth-api',
  );

  content = content
    .replace(/^RUN pnpm --filter @forgeon\/auth-contracts build\r?\n?/gm, '')
    .replace(/^RUN pnpm --filter @forgeon\/auth-api build\r?\n?/gm, '');

  const buildAnchor = content.includes('RUN pnpm --filter @forgeon/api prisma:generate')
    ? 'RUN pnpm --filter @forgeon/api prisma:generate'
    : 'RUN pnpm --filter @forgeon/api build';
  content = ensureLineBefore(content, buildAnchor, 'RUN pnpm --filter @forgeon/auth-contracts build');
  content = ensureLineBefore(content, buildAnchor, 'RUN pnpm --filter @forgeon/auth-api build');

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchCompose(targetRoot) {
  const composePath = path.join(targetRoot, 'infra', 'docker', 'compose.yml');
  if (!fs.existsSync(composePath)) {
    return;
  }

  let content = fs.readFileSync(composePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes('JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}')) {
    content = content.replace(
      /^(\s+API_PREFIX:.*)$/m,
      `$1
      JWT_ACCESS_SECRET: \${JWT_ACCESS_SECRET}
      JWT_ACCESS_EXPIRES_IN: \${JWT_ACCESS_EXPIRES_IN}
      JWT_REFRESH_SECRET: \${JWT_REFRESH_SECRET}
      JWT_REFRESH_EXPIRES_IN: \${JWT_REFRESH_EXPIRES_IN}
      AUTH_BCRYPT_ROUNDS: \${AUTH_BCRYPT_ROUNDS}
      AUTH_DEMO_EMAIL: \${AUTH_DEMO_EMAIL}
      AUTH_DEMO_PASSWORD: \${AUTH_DEMO_PASSWORD}`,
    );
  }

  fs.writeFileSync(composePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchReadme(targetRoot, dbAdapter) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const persistenceSummary =
    dbAdapter?.supported && dbAdapter.id === 'db-prisma'
      ? '- refresh token persistence: enabled (`db-prisma` adapter)'
      : '- refresh token persistence: disabled (no supported DB adapter found)';
  const dbFollowUp =
    dbAdapter?.supported && dbAdapter.id === 'db-prisma'
      ? '- migration: `apps/api/prisma/migrations/0002_auth_refresh_token_hash`'
      : `- to enable persistence later:
  1. install a DB module first (for now: \`create-forgeon add db-prisma --project .\`);
  2. run \`create-forgeon add jwt-auth --project .\` again to auto-wire the adapter.`;

  const section = `${JWT_README_START}
## JWT Auth Module

The jwt-auth add-module provides:
- \`@forgeon/auth-contracts\` shared auth routes/types/error codes
- \`@forgeon/auth-api\` Nest auth module (\`login\`, \`refresh\`, \`logout\`, \`me\`)
- JWT guard + passport strategy
- auth probe endpoint: \`GET /api/health/auth\`

Current mode:
${persistenceSummary}
${dbFollowUp}

Default demo credentials:
- \`AUTH_DEMO_EMAIL=demo@forgeon.local\`
- \`AUTH_DEMO_PASSWORD=forgeon-demo-password\`

Default routes:
- \`POST /api/auth/login\`
- \`POST /api/auth/refresh\`
- \`POST /api/auth/logout\`
- \`GET /api/auth/me\`
${JWT_README_END}`;

  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  const sectionPattern = new RegExp(`${JWT_README_START}[\\s\\S]*?${JWT_README_END}`, 'm');
  if (sectionPattern.test(content)) {
    content = content.replace(sectionPattern, section);
  } else if (content.includes('## Prisma In Docker Start')) {
    content = content.replace('## Prisma In Docker Start', `${section}\n\n## Prisma In Docker Start`);
  } else {
    content = `${content.trimEnd()}\n\n${section}\n`;
  }

  fs.writeFileSync(readmePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchPrismaSchema(targetRoot) {
  const schemaPath = path.join(targetRoot, 'apps', 'api', 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    return;
  }

  let content = fs.readFileSync(schemaPath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes('refreshTokenHash')) {
    content = content.replace(
      /email\s+String\s+@unique/g,
      'email            String   @unique\n  refreshTokenHash String?',
    );
    fs.writeFileSync(schemaPath, `${content.trimEnd()}\n`, 'utf8');
  }
}

function patchPrismaMigration(packageRoot, targetRoot) {
  const migrationSource = path.join(
    packageRoot,
    'templates',
    'module-presets',
    'jwt-auth',
    'apps',
    'api',
    'prisma',
    'migrations',
    '0002_auth_refresh_token_hash',
  );
  const migrationTarget = path.join(
    targetRoot,
    'apps',
    'api',
    'prisma',
    'migrations',
    '0002_auth_refresh_token_hash',
  );

  if (!fs.existsSync(migrationTarget) && fs.existsSync(migrationSource)) {
    copyRecursive(migrationSource, migrationTarget);
  }
}

export function applyJwtAuthModule({ packageRoot, targetRoot }) {
  const dbAdapter = detectDbAdapter(targetRoot);
  const supportsPrismaStore = dbAdapter?.supported === true && dbAdapter?.id === 'db-prisma';

  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'auth-contracts'));
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'auth-api'));

  if (supportsPrismaStore) {
    copyFromPreset(
      packageRoot,
      targetRoot,
      path.join('apps', 'api', 'src', 'auth', 'prisma-auth-refresh-token.store.ts'),
    );
    patchPrismaSchema(targetRoot);
    patchPrismaMigration(packageRoot, targetRoot);
  } else {
    const detected = dbAdapter?.id ? `detected: ${dbAdapter.id}` : 'no DB adapter detected';
    printDbWarning(
      `jwt-auth installed without persistent refresh token store (${detected}). ` +
        'Login/refresh works in stateless mode. Re-run add after supported DB module is installed.',
    );
  }

  patchApiPackage(targetRoot);
  patchAppModule(targetRoot, dbAdapter);
  patchHealthController(targetRoot);
  patchWebApp(targetRoot);
  patchApiDockerfile(targetRoot);
  patchCompose(targetRoot);
  patchReadme(targetRoot, dbAdapter);

  upsertEnvLines(path.join(targetRoot, 'apps', 'api', '.env.example'), [
    'JWT_ACCESS_SECRET=forgeon-access-secret-change-me',
    'JWT_ACCESS_EXPIRES_IN=15m',
    'JWT_REFRESH_SECRET=forgeon-refresh-secret-change-me',
    'JWT_REFRESH_EXPIRES_IN=7d',
    'AUTH_BCRYPT_ROUNDS=10',
    'AUTH_DEMO_EMAIL=demo@forgeon.local',
    'AUTH_DEMO_PASSWORD=forgeon-demo-password',
  ]);

  upsertEnvLines(path.join(targetRoot, 'infra', 'docker', '.env.example'), [
    'JWT_ACCESS_SECRET=forgeon-access-secret-change-me',
    'JWT_ACCESS_EXPIRES_IN=15m',
    'JWT_REFRESH_SECRET=forgeon-refresh-secret-change-me',
    'JWT_REFRESH_EXPIRES_IN=7d',
    'AUTH_BCRYPT_ROUNDS=10',
    'AUTH_DEMO_EMAIL=demo@forgeon.local',
    'AUTH_DEMO_PASSWORD=forgeon-demo-password',
  ]);
}
