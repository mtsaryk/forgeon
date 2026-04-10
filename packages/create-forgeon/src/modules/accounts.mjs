import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive, writeJson } from '../utils/fs.mjs';
import {
  ensureBuildSteps,
  ensureDependency,
  ensureImportLine,
  ensureLineAfter,
  ensureLineBefore,
  ensureLoadItem,
  ensureValidatorSchema,
  upsertEnvLines,
} from './shared/patch-utils.mjs';
import { patchHealthControllerServiceProbe } from './shared/nest-runtime-wiring.mjs';
import { ensureWebProbeDefinition, resolveProbeTargets } from './shared/probes.mjs';

const ACCOUNTS_RBAC_MARKERS = {
  start: '<!-- forgeon:accounts:rbac:start -->',
  end: '<!-- forgeon:accounts:rbac:end -->',
};

const ACCOUNTS_DEFAULT_RBAC_BLOCK =
  '- RBAC compatibility sync: not enabled by default (add `rbac` and run `pnpm forgeon:sync-integrations` to prepare claims compatibility without changing the base accounts schema).';

function copyFromPreset(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'module-presets', 'accounts', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing accounts preset template: ${source}`);
  }
  const destination = path.join(targetRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  copyRecursive(source, destination);
}

function patchApiPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'apps', 'api', 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  ensureDependency(packageJson, '@forgeon/accounts-api', 'workspace:*');
  ensureDependency(packageJson, '@forgeon/accounts-contracts', 'workspace:*');

  ensureBuildSteps(packageJson, 'predev', [
    'pnpm --filter @forgeon/accounts-contracts build',
    'pnpm --filter @forgeon/accounts-api build',
  ]);

  writeJson(packagePath, packageJson);
}

function patchPrismaSchema(targetRoot) {
  const schemaPath = path.join(targetRoot, 'apps', 'api', 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    return;
  }

  let content = fs.readFileSync(schemaPath, 'utf8').replace(/\r\n/g, '\n');
  const userModel = `model User {
  id               String             @id @default(cuid())
  status           String             @default("active")
  data             Json?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt
  deletedAt        DateTime?
  profile          UserProfile?
  settings         UserSettings?
  authIdentities   AuthIdentity[]
  authCredential   AuthCredential?
  authRefreshTokens AuthRefreshToken[]
}`;

  if (/model User \{[\s\S]*?\n\}/m.test(content)) {
    content = content.replace(/model User \{[\s\S]*?\n\}/m, userModel);
  } else {
    content = `${content.trimEnd()}\n\n${userModel}\n`;
  }

  const extraModels = [
    `model UserProfile {
  userId    String   @id
  name      String?
  avatar    String?
  data      Json?
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}`,
    `model UserSettings {
  userId    String   @id
  theme     String?
  locale    String?
  data      Json?
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}`,
    `model AuthIdentity {
  id         String   @id @default(cuid())
  userId     String
  provider   String
  providerId String
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerId])
}`,
    `model AuthCredential {
  id           String   @id @default(cuid())
  userId       String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}`,
    `model AuthRefreshToken {
  id         String   @id @default(cuid())
  userId     String
  tokenHash  String
  expiresAt  DateTime
  revokedAt  DateTime?
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
}`,
  ];

  for (const model of extraModels) {
    const name = model.match(/^model\s+(\w+)/m)?.[1];
    if (!name || content.includes(`model ${name} {`)) {
      continue;
    }
    content = `${content.trimEnd()}\n\n${model}\n`;
  }

  fs.writeFileSync(schemaPath, `${content.trimEnd()}\n`, 'utf8');
}

function copyMigrationFolder(packageRoot, targetRoot, migrationName) {
  const migrationDir = path.join(targetRoot, 'apps', 'api', 'prisma', 'migrations', migrationName);
  const migrationFile = path.join(migrationDir, 'migration.sql');
  if (fs.existsSync(migrationFile)) {
    return;
  }

  const sourceDir = path.join(
    packageRoot,
    'templates',
    'module-presets',
    'accounts',
    'apps',
    'api',
    'prisma',
    'migrations',
    migrationName,
  );
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  fs.mkdirSync(path.dirname(migrationDir), { recursive: true });
  copyRecursive(sourceDir, migrationDir);
}

function patchPrismaMigration(packageRoot, targetRoot) {
  copyMigrationFolder(packageRoot, targetRoot, '0002_accounts_core');
}

function patchAppModule(targetRoot) {
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  content = content.replace(
    "import { ACCOUNTS_PERSISTENCE_PORT, authConfig, authEnvSchema, ForgeonAccountsModule, UsersModule } from '@forgeon/accounts-api';",
    "import { authConfig, authEnvSchema, ForgeonAccountsModule, UsersModule } from '@forgeon/accounts-api';",
  );
  content = content.replace(
    "import { authConfig, authEnvSchema, ForgeonAccountsModule } from '@forgeon/accounts-api';",
    "import { authConfig, authEnvSchema, ForgeonAccountsModule, UsersModule } from '@forgeon/accounts-api';",
  );
  content = ensureImportLine(
    content,
    "import { authConfig, authEnvSchema, ForgeonAccountsModule, UsersModule } from '@forgeon/accounts-api';",
  );
  content = content.replace(
    /^import \{ PrismaAccountsPersistenceStore \} from '\.\/accounts\/prisma-accounts-persistence\.store';\r?\n/m,
    '',
  );
  content = content.replace(
    /^import \{ ForgeonAccountsDbPrismaModule \} from '\.\/accounts\/forgeon-accounts-db-prisma\.module';\r?\n/m,
    '',
  );
  content = ensureLoadItem(content, 'authConfig');
  content = ensureValidatorSchema(content, 'authEnvSchema');
  content = content.replace(/^\s*ForgeonAccountsDbPrismaModule,\r?\n/gm, '');

  const accountsModuleLine = `    ForgeonAccountsModule.register({
      users: UsersModule.register({}),
    }),`;

  if (content.includes('    ForgeonAccountsModule.register({')) {
    content = content.replace(
      / {4}ForgeonAccountsModule\.register\([\s\S]*? {4}\}\),/m,
      accountsModuleLine,
    );
  } else if (content.includes('    ForgeonI18nModule.register({')) {
    content = ensureLineBefore(content, '    ForgeonI18nModule.register({', accountsModuleLine);
  } else if (content.includes('    DbPrismaModule,')) {
    content = ensureLineAfter(content, '    DbPrismaModule,', accountsModuleLine);
  } else {
    content = ensureLineAfter(content, '    CoreErrorsModule,', accountsModuleLine);
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}
function patchHealthController(targetRoot, probeTargets) {
  patchHealthControllerServiceProbe(targetRoot, probeTargets, {
    importLine: "import { AuthService } from '@forgeon/accounts-api';",
    constructorMember: 'private readonly authService: AuthService',
    routePath: 'auth',
    methodName: 'getAuthProbe',
    serviceCall: 'this.authService.getProbeStatus()',
    beforeNeedles: ["@Post('db')"],
    beforeNeedle: 'private translate(',
  });
}

function registerWebProbe(targetRoot, probeTargets) {
  ensureWebProbeDefinition({
    targetRoot,
    probeTargets,
    definition: {
      id: 'auth',
      title: 'Accounts',
      buttonLabel: 'Check accounts probe',
      resultTitle: 'Accounts probe response',
      path: '/health/auth',
    },
  });
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
    'COPY packages/accounts-contracts/package.json packages/accounts-contracts/package.json',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/accounts-contracts/package.json packages/accounts-contracts/package.json',
    'COPY packages/accounts-api/package.json packages/accounts-api/package.json',
  );

  const sourceAnchors = [
    'COPY packages/swagger packages/swagger',
    'COPY packages/logger packages/logger',
    'COPY packages/i18n packages/i18n',
    'COPY packages/db-prisma packages/db-prisma',
    'COPY packages/core packages/core',
  ];
  const sourceAnchor = sourceAnchors.find((line) => content.includes(line)) ?? sourceAnchors.at(-1);
  content = ensureLineAfter(content, sourceAnchor, 'COPY packages/accounts-contracts packages/accounts-contracts');
  content = ensureLineAfter(
    content,
    'COPY packages/accounts-contracts packages/accounts-contracts',
    'COPY packages/accounts-api packages/accounts-api',
  );

  content = content
    .replace(/^RUN pnpm --filter @forgeon\/auth-contracts build\r?\n?/gm, '')
    .replace(/^RUN pnpm --filter @forgeon\/auth-api build\r?\n?/gm, '');

  const buildAnchor = content.includes('RUN pnpm --filter @forgeon/api prisma:generate')
    ? 'RUN pnpm --filter @forgeon/api prisma:generate'
    : 'RUN pnpm --filter @forgeon/api build';
  content = ensureLineBefore(content, buildAnchor, 'RUN pnpm --filter @forgeon/accounts-contracts build');
  content = ensureLineBefore(content, buildAnchor, 'RUN pnpm --filter @forgeon/accounts-api build');

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
      AUTH_ARGON2_MEMORY_COST: \${AUTH_ARGON2_MEMORY_COST}
      AUTH_ARGON2_TIME_COST: \${AUTH_ARGON2_TIME_COST}
      AUTH_ARGON2_PARALLELISM: \${AUTH_ARGON2_PARALLELISM}`,
    );
  }

  fs.writeFileSync(composePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const section = [
    '## Accounts Module',
    '',
    'The accounts add-module provides a DB-backed accounts/authentication surface with owner-scoped user routes.',
    '',
    'What it adds:',
    '- `@forgeon/accounts-contracts` shared contracts for auth and self-service users routes',
    '- `@forgeon/accounts-api` Nest accounts runtime with JWT auth, argon2 passwords, and hashed refresh-token rotation',
    '- owner-scoped routes under `/api/users/:id`, `/api/users/:id/profile`, and `/api/users/:id/settings` (`/users/me` resolves through the same surface)',
    '- auth probe endpoint: `GET /api/health/auth`',
    '',
    'Current boundaries:',
    '- `UsersModule.register({ user, profile, settings })` controls runtime defaults for JSON-backed extension fields',
    '- email verification and password-reset request flows send best-effort communication intents through `CommunicationsService`',
    '- base accounts schema does not include RBAC storage',
    ACCOUNTS_RBAC_MARKERS.start,
    ACCOUNTS_DEFAULT_RBAC_BLOCK,
    ACCOUNTS_RBAC_MARKERS.end,
    '',
    'Default routes:',
    '- `POST /api/auth/register`',
    '- `POST /api/auth/login`',
    '- `POST /api/auth/refresh`',
    '- `POST /api/auth/logout`',
    '- `GET /api/auth/me`',
    '- `POST /api/auth/change-password`',
    '- `POST /api/auth/verify-email` (stub)',
    '- `POST /api/auth/password-reset/request` (stub)',
    '- `POST /api/auth/password-reset/confirm` (stub)',
  ].join('\n');

  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  const sectionHeading = '## Accounts Module';
  if (content.includes(sectionHeading)) {
    const start = content.indexOf(sectionHeading);
    const tail = content.slice(start + sectionHeading.length);
    const nextHeadingMatch = tail.match(/\n##\s+/);
    const end =
      nextHeadingMatch && nextHeadingMatch.index !== undefined
        ? start + sectionHeading.length + nextHeadingMatch.index + 1
        : content.length;
    content = `${content.slice(0, start)}${section}\n\n${content.slice(end).replace(/^\n+/, '')}`;
  } else if (content.includes('## Prisma In Docker Start')) {
    content = content.replace('## Prisma In Docker Start', `${section}\n\n## Prisma In Docker Start`);
  } else {
    content = `${content.trimEnd()}\n\n${section}\n`;
  }

  fs.writeFileSync(readmePath, `${content.trimEnd()}\n`, 'utf8');
}

export function applyAccountsModule({ packageRoot, targetRoot }) {
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'accounts-contracts'));
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'accounts-api'));
  copyFromPreset(
    packageRoot,
    targetRoot,
    path.join('apps', 'api', 'prisma', 'migrations', '0002_accounts_core'),
  );

  const probeTargets = resolveProbeTargets({ targetRoot, moduleId: 'accounts' });

  patchApiPackage(targetRoot);
  patchPrismaSchema(targetRoot);
  patchPrismaMigration(packageRoot, targetRoot);
  patchAppModule(targetRoot);
  patchHealthController(targetRoot, probeTargets);
  registerWebProbe(targetRoot, probeTargets);
  patchApiDockerfile(targetRoot);
  patchCompose(targetRoot);
  patchReadme(targetRoot);

  upsertEnvLines(path.join(targetRoot, 'apps', 'api', '.env.example'), [
    'JWT_ACCESS_SECRET=forgeon-access-secret-change-me',
    'JWT_ACCESS_EXPIRES_IN=15m',
    'JWT_REFRESH_SECRET=forgeon-refresh-secret-change-me',
    'JWT_REFRESH_EXPIRES_IN=7d',
    'AUTH_ARGON2_MEMORY_COST=19456',
    'AUTH_ARGON2_TIME_COST=2',
    'AUTH_ARGON2_PARALLELISM=1',
  ]);

  upsertEnvLines(path.join(targetRoot, 'infra', 'docker', '.env.example'), [
    'JWT_ACCESS_SECRET=forgeon-access-secret-change-me',
    'JWT_ACCESS_EXPIRES_IN=15m',
    'JWT_REFRESH_SECRET=forgeon-refresh-secret-change-me',
    'JWT_REFRESH_EXPIRES_IN=7d',
    'AUTH_ARGON2_MEMORY_COST=19456',
    'AUTH_ARGON2_TIME_COST=2',
    'AUTH_ARGON2_PARALLELISM=1',
  ]);
}







