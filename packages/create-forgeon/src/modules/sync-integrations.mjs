import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive } from '../utils/fs.mjs';

const PRISMA_AUTH_STORE_TEMPLATE = path.join(
  'templates',
  'module-presets',
  'jwt-auth',
  'apps',
  'api',
  'src',
  'auth',
  'prisma-auth-refresh-token.store.ts',
);

const PRISMA_AUTH_MIGRATION_TEMPLATE = path.join(
  'templates',
  'module-presets',
  'jwt-auth',
  'apps',
  'api',
  'prisma',
  'migrations',
  '0002_auth_refresh_token_hash',
);

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

function isAuthPersistencePending(rootDir) {
  const appModulePath = path.join(rootDir, 'apps', 'api', 'src', 'app.module.ts');
  const schemaPath = path.join(rootDir, 'apps', 'api', 'prisma', 'schema.prisma');
  const storePath = path.join(rootDir, 'apps', 'api', 'src', 'auth', 'prisma-auth-refresh-token.store.ts');
  const migrationPath = path.join(
    rootDir,
    'apps',
    'api',
    'prisma',
    'migrations',
    '0002_auth_refresh_token_hash',
    'migration.sql',
  );

  if (!fs.existsSync(appModulePath) || !fs.existsSync(schemaPath)) {
    return false;
  }

  const appModule = fs.readFileSync(appModulePath, 'utf8');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const hasModuleWiring =
    appModule.includes('refreshTokenStoreProvider') &&
    appModule.includes('PrismaAuthRefreshTokenStore') &&
    appModule.includes('AUTH_REFRESH_TOKEN_STORE');
  const hasSchema = schema.includes('refreshTokenHash');
  const hasStoreFile = fs.existsSync(storePath);
  const hasMigration = fs.existsSync(migrationPath);

  return !(hasModuleWiring && hasSchema && hasStoreFile && hasMigration);
}

const INTEGRATION_GROUPS = [
  {
    id: 'auth-persistence',
    title: 'Auth Persistence Integration',
    modules: ['jwt-auth', 'db-prisma'],
    description: [
      'Patch AppModule to wire AUTH_REFRESH_TOKEN_STORE with PrismaAuthRefreshTokenStore',
      'Add apps/api/src/auth/prisma-auth-refresh-token.store.ts',
      'Extend Prisma User model with refreshTokenHash and add migration 0002_auth_refresh_token_hash',
      'Update JWT auth README note about refresh-token persistence',
    ],
    isAvailable: (detected) => detected.jwtAuth && detected.dbPrisma,
    isPending: (rootDir) => isAuthPersistencePending(rootDir),
    apply: syncJwtDbPrisma,
  },
];

function detectModules(rootDir) {
  const appModulePath = path.join(rootDir, 'apps', 'api', 'src', 'app.module.ts');
  const appModuleText = fs.existsSync(appModulePath) ? fs.readFileSync(appModulePath, 'utf8') : '';

  return {
    jwtAuth:
      fs.existsSync(path.join(rootDir, 'packages', 'auth-api', 'package.json')) ||
      appModuleText.includes("from '@forgeon/auth-api'"),
    dbPrisma:
      fs.existsSync(path.join(rootDir, 'packages', 'db-prisma', 'package.json')) ||
      appModuleText.includes("from '@forgeon/db-prisma'"),
  };
}

function syncJwtDbPrisma({ rootDir, packageRoot, changedFiles }) {
  const appModulePath = path.join(rootDir, 'apps', 'api', 'src', 'app.module.ts');
  const schemaPath = path.join(rootDir, 'apps', 'api', 'prisma', 'schema.prisma');
  const readmePath = path.join(rootDir, 'README.md');
  const storePath = path.join(rootDir, 'apps', 'api', 'src', 'auth', 'prisma-auth-refresh-token.store.ts');
  const migrationPath = path.join(
    rootDir,
    'apps',
    'api',
    'prisma',
    'migrations',
    '0002_auth_refresh_token_hash',
    'migration.sql',
  );

  if (!fs.existsSync(appModulePath) || !fs.existsSync(schemaPath)) {
    return { applied: false, reason: 'app module or prisma schema is missing' };
  }

  let touched = false;

  if (!fs.existsSync(storePath)) {
    const storeSource = path.join(packageRoot, PRISMA_AUTH_STORE_TEMPLATE);
    if (!fs.existsSync(storeSource)) {
      return { applied: false, reason: 'jwt-auth prisma store template is missing' };
    }
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    copyRecursive(storeSource, storePath);
    changedFiles.add(storePath);
    touched = true;
  }

  let appModule = fs.readFileSync(appModulePath, 'utf8').replace(/\r\n/g, '\n');
  const originalAppModule = appModule;

  if (!appModule.includes("AUTH_REFRESH_TOKEN_STORE, authConfig")) {
    appModule = appModule.replace(
      /import\s*\{\s*authConfig,\s*authEnvSchema,\s*ForgeonAuthModule\s*\}\s*from '@forgeon\/auth-api';/m,
      "import { AUTH_REFRESH_TOKEN_STORE, authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';",
    );
  }

  const storeImportLine = "import { PrismaAuthRefreshTokenStore } from './auth/prisma-auth-refresh-token.store';";
  if (!appModule.includes(storeImportLine)) {
    appModule = ensureLineAfter(
      appModule,
      "import { HealthController } from './health/health.controller';",
      storeImportLine,
    );
  }

  if (!appModule.includes('refreshTokenStoreProvider')) {
    appModule = appModule.replace(
      /ForgeonAuthModule\.register\(\),/m,
      `ForgeonAuthModule.register({
      imports: [DbPrismaModule],
      refreshTokenStoreProvider: {
        provide: AUTH_REFRESH_TOKEN_STORE,
        useClass: PrismaAuthRefreshTokenStore,
      },
    }),`,
    );
  }

  if (appModule !== originalAppModule) {
    fs.writeFileSync(appModulePath, `${appModule.trimEnd()}\n`, 'utf8');
    changedFiles.add(appModulePath);
    touched = true;
  }

  let schema = fs.readFileSync(schemaPath, 'utf8').replace(/\r\n/g, '\n');
  const originalSchema = schema;
  if (!schema.includes('refreshTokenHash')) {
    schema = schema.replace(/email\s+String\s+@unique/g, 'email            String   @unique\n  refreshTokenHash String?');
  }
  if (schema !== originalSchema) {
    fs.writeFileSync(schemaPath, `${schema.trimEnd()}\n`, 'utf8');
    changedFiles.add(schemaPath);
    touched = true;
  }

  if (!fs.existsSync(migrationPath)) {
    const migrationSource = path.join(packageRoot, PRISMA_AUTH_MIGRATION_TEMPLATE);
    if (!fs.existsSync(migrationSource)) {
      return { applied: false, reason: 'jwt-auth migration template is missing' };
    }
    const migrationDir = path.dirname(migrationPath);
    fs.mkdirSync(path.dirname(migrationDir), { recursive: true });
    copyRecursive(migrationSource, migrationDir);
    changedFiles.add(migrationPath);
    touched = true;
  }

  if (fs.existsSync(readmePath)) {
    let readme = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
    const originalReadme = readme;
    readme = readme.replace(
      '- refresh token persistence: disabled by default (stateless mode)',
      '- refresh token persistence: enabled (`db-prisma` adapter)',
    );
    readme = readme.replace(
      /- to enable persistence later:[\s\S]*?2\. run `pnpm forgeon:sync-integrations` to auto-wire pair integrations\./m,
      '- migration: `apps/api/prisma/migrations/0002_auth_refresh_token_hash`',
    );
    if (readme !== originalReadme) {
      fs.writeFileSync(readmePath, `${readme.trimEnd()}\n`, 'utf8');
      changedFiles.add(readmePath);
      touched = true;
    }
  }

  if (!touched) {
    return { applied: false, reason: 'already synced' };
  }
  return { applied: true };
}

export function syncIntegrations({ targetRoot, packageRoot, groupIds = null }) {
  const rootDir = path.resolve(targetRoot);
  const changedFiles = new Set();
  const detected = detectModules(rootDir);
  const summary = [];
  const available = INTEGRATION_GROUPS.filter(
    (group) => group.isAvailable(detected) && group.isPending(rootDir),
  );
  const selected = Array.isArray(groupIds)
    ? available.filter((group) => groupIds.includes(group.id))
    : available;

  for (const group of selected) {
    summary.push({
      id: group.id,
      title: group.title,
      modules: group.modules,
      result: group.apply({ rootDir, packageRoot, changedFiles }),
    });
  }

  return {
    summary,
    availableGroups: available.map((group) => ({
      id: group.id,
      title: group.title,
      modules: [...group.modules],
      description: [...group.description],
    })),
    changedFiles: [...changedFiles].sort().map((filePath) => path.relative(rootDir, filePath)),
  };
}

export function scanIntegrations({ targetRoot, relatedModuleId = null }) {
  const rootDir = path.resolve(targetRoot);
  const detected = detectModules(rootDir);
  const available = INTEGRATION_GROUPS.filter(
    (group) =>
      group.isAvailable(detected) &&
      group.isPending(rootDir) &&
      (!relatedModuleId || group.modules.includes(relatedModuleId)),
  );
  return {
    groups: available.map((group) => ({
      id: group.id,
      title: group.title,
      modules: [...group.modules],
      description: [...group.description],
    })),
  };
}
