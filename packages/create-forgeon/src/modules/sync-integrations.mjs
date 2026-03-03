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

const AUTH_PERSISTENCE_STRATEGIES = [
  {
    id: 'db-prisma',
    capability: 'db-adapter',
    providerLabel: 'db-prisma',
    participants: ['jwt-auth', 'db-adapter'],
    relatedModules: ['jwt-auth', 'db-prisma'],
    description: [
      'Patch AppModule to wire AUTH_REFRESH_TOKEN_STORE to the current db-adapter implementation (today: PrismaAuthRefreshTokenStore)',
      'Add apps/api/src/auth/prisma-auth-refresh-token.store.ts',
      'Extend Prisma User model with refreshTokenHash and add migration 0002_auth_refresh_token_hash',
      'Update JWT auth README note to reflect db-adapter-backed refresh-token persistence',
    ],
    isDetected: (detected) => detected.dbPrisma,
    isPending: isAuthPersistencePending,
    apply: syncJwtDbPrisma,
  },
];

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

function isAuthRbacPending(rootDir) {
  const authContractsPath = path.join(rootDir, 'packages', 'auth-contracts', 'src', 'index.ts');
  const authServicePath = path.join(rootDir, 'packages', 'auth-api', 'src', 'auth.service.ts');
  const authControllerPath = path.join(rootDir, 'packages', 'auth-api', 'src', 'auth.controller.ts');

  if (!fs.existsSync(authContractsPath) || !fs.existsSync(authServicePath) || !fs.existsSync(authControllerPath)) {
    return false;
  }

  const authContracts = fs.readFileSync(authContractsPath, 'utf8');
  const authService = fs.readFileSync(authServicePath, 'utf8');
  const authController = fs.readFileSync(authControllerPath, 'utf8');

  const hasContracts = authContracts.includes('permissions?: string[];');
  const hasDemoClaims = authService.includes("permissions: ['health.rbac']");
  const hasPayloadClaims = authService.includes('permissions: user.permissions,');
  const hasRefreshClaims = authService.includes('permissions: Array.isArray(payload.permissions) ? payload.permissions : [],');
  const hasControllerClaims =
    authController.includes('permissions: Array.isArray(payload.permissions) ? payload.permissions : [],');

  return !(hasContracts && hasDemoClaims && hasPayloadClaims && hasRefreshClaims && hasControllerClaims);
}

const INTEGRATION_GROUPS = [
  {
    id: 'auth-persistence',
    title: 'Auth Persistence Integration',
    participants: ['jwt-auth', 'db-adapter'],
    relatedModules: ['jwt-auth', 'db-prisma'],
    description: (detected) => getAuthPersistenceDescription(detected),
    isAvailable: (detected) => detected.jwtAuth && hasSingleAuthPersistenceStrategy(detected),
    isPending: (rootDir, detected) => isAuthPersistencePendingForDetected(rootDir, detected),
    apply: applyAuthPersistenceSync,
  },
  {
    id: 'auth-rbac-claims',
    title: 'Auth Claims Integration',
    participants: ['jwt-auth', 'rbac'],
    relatedModules: ['jwt-auth', 'rbac'],
    description: [
      'Extend AuthUser with optional permissions in @forgeon/auth-contracts',
      'Add demo RBAC claims to jwt-auth login and token payloads',
      'Expose permissions in auth refresh and /me responses',
      'Update JWT auth README note about RBAC demo claims',
    ],
    isAvailable: (detected) => detected.jwtAuth && detected.rbac,
    isPending: (rootDir) => isAuthRbacPending(rootDir),
    apply: syncJwtRbacClaims,
  },
];

function detectModules(rootDir) {
  const appModulePath = path.join(rootDir, 'apps', 'api', 'src', 'app.module.ts');
  const appModuleText = fs.existsSync(appModulePath) ? fs.readFileSync(appModulePath, 'utf8') : '';

  return {
    jwtAuth:
      fs.existsSync(path.join(rootDir, 'packages', 'auth-api', 'package.json')) ||
      appModuleText.includes("from '@forgeon/auth-api'"),
    rbac:
      fs.existsSync(path.join(rootDir, 'packages', 'rbac', 'package.json')) ||
      appModuleText.includes("from '@forgeon/rbac'"),
    dbPrisma:
      fs.existsSync(path.join(rootDir, 'packages', 'db-prisma', 'package.json')) ||
      appModuleText.includes("from '@forgeon/db-prisma'"),
  };
}

function resolveAuthPersistenceStrategy(detected) {
  const matched = AUTH_PERSISTENCE_STRATEGIES.filter((strategy) => strategy.isDetected(detected));
  if (matched.length === 0) {
    return { kind: 'none' };
  }
  if (matched.length > 1) {
    return { kind: 'conflict', strategies: matched };
  }
  return { kind: 'single', strategy: matched[0] };
}

function hasSingleAuthPersistenceStrategy(detected) {
  return resolveAuthPersistenceStrategy(detected).kind === 'single';
}

function getAuthPersistenceDescription(detected) {
  const resolved = resolveAuthPersistenceStrategy(detected);
  if (resolved.kind === 'single') {
    return [...resolved.strategy.description];
  }
  return [
    'Use the current db-adapter provider strategy to wire refresh-token persistence.',
    'A supported db-adapter provider must be installed before this integration can apply.',
  ];
}

function isAuthPersistencePendingForDetected(rootDir, detected) {
  const resolved = resolveAuthPersistenceStrategy(detected);
  if (resolved.kind !== 'single') {
    return false;
  }
  return resolved.strategy.isPending(rootDir);
}

function applyAuthPersistenceSync({ rootDir, packageRoot, changedFiles }) {
  const detected = detectModules(rootDir);
  const resolved = resolveAuthPersistenceStrategy(detected);
  if (resolved.kind === 'none') {
    return { applied: false, reason: 'no supported db-adapter provider detected' };
  }
  if (resolved.kind === 'conflict') {
    return { applied: false, reason: 'multiple db-adapter providers detected' };
  }
  return resolved.strategy.apply({ rootDir, packageRoot, changedFiles });
}

function getGroupParticipants(group) {
  return Array.isArray(group.participants) && group.participants.length > 0
    ? group.participants
    : Array.isArray(group.modules)
      ? group.modules
      : [];
}

function getGroupRelatedModules(group) {
  return Array.isArray(group.relatedModules) && group.relatedModules.length > 0
    ? group.relatedModules
    : getGroupParticipants(group);
}

function getGroupDescription(group, detected) {
  if (typeof group.description === 'function') {
    return group.description(detected);
  }
  return Array.isArray(group.description) ? group.description : [];
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
      '- refresh token persistence: disabled by default (stateless mode; enable it later through a `db-adapter` provider + integration sync)',
      '- refresh token persistence: enabled through the `db-adapter` capability (current provider: `db-prisma`)',
    );
    readme = readme.replace(
      /- to enable persistence later:[\s\S]*?2\. run `pnpm forgeon:sync-integrations` to wire auth persistence to the active DB adapter implementation\./m,
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

function syncJwtRbacClaims({ rootDir, changedFiles }) {
  const authContractsPath = path.join(rootDir, 'packages', 'auth-contracts', 'src', 'index.ts');
  const authServicePath = path.join(rootDir, 'packages', 'auth-api', 'src', 'auth.service.ts');
  const authControllerPath = path.join(rootDir, 'packages', 'auth-api', 'src', 'auth.controller.ts');
  const readmePath = path.join(rootDir, 'README.md');

  if (!fs.existsSync(authContractsPath) || !fs.existsSync(authServicePath) || !fs.existsSync(authControllerPath)) {
    return { applied: false, reason: 'auth package files are missing' };
  }

  let touched = false;

  let authContracts = fs.readFileSync(authContractsPath, 'utf8').replace(/\r\n/g, '\n');
  const originalAuthContracts = authContracts;
  if (!authContracts.includes('permissions?: string[];')) {
    authContracts = authContracts.replace(
      '  roles: string[];',
      `  roles: string[];
  permissions?: string[];`,
    );
  }
  if (authContracts !== originalAuthContracts) {
    fs.writeFileSync(authContractsPath, `${authContracts.trimEnd()}\n`, 'utf8');
    changedFiles.add(authContractsPath);
    touched = true;
  }

  let authService = fs.readFileSync(authServicePath, 'utf8').replace(/\r\n/g, '\n');
  const originalAuthService = authService;
  authService = authService.replace(
    /roles: \['user'\],/g,
    `roles: ['admin'],
      permissions: ['health.rbac'],`,
  );
  if (!authService.includes('permissions: user.permissions,')) {
    authService = authService.replace(
      '      roles: user.roles,',
      `      roles: user.roles,
      permissions: user.permissions,`,
    );
  }
  if (!authService.includes('permissions: Array.isArray(payload.permissions) ? payload.permissions : [],')) {
    authService = authService.replace(
      "      roles: Array.isArray(payload.roles) ? payload.roles : ['user'],",
      `      roles: Array.isArray(payload.roles) ? payload.roles : ['user'],
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],`,
    );
  }
  if (!authService.includes('demoPermissions: [')) {
    authService = authService.replace(
      "      demoEmail: this.configService.demoEmail,",
      `      demoEmail: this.configService.demoEmail,
      demoPermissions: ['health.rbac'],`,
    );
  }
  if (authService !== originalAuthService) {
    fs.writeFileSync(authServicePath, `${authService.trimEnd()}\n`, 'utf8');
    changedFiles.add(authServicePath);
    touched = true;
  }

  let authController = fs.readFileSync(authControllerPath, 'utf8').replace(/\r\n/g, '\n');
  const originalAuthController = authController;
  if (!authController.includes('permissions: Array.isArray(payload.permissions) ? payload.permissions : [],')) {
    authController = authController.replace(
      "      roles: Array.isArray(payload.roles) ? payload.roles : ['user'],",
      `      roles: Array.isArray(payload.roles) ? payload.roles : ['user'],
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],`,
    );
  }
  if (authController !== originalAuthController) {
    fs.writeFileSync(authControllerPath, `${authController.trimEnd()}\n`, 'utf8');
    changedFiles.add(authControllerPath);
    touched = true;
  }

  if (fs.existsSync(readmePath)) {
    let readme = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
    const originalReadme = readme;
    if (!readme.includes('- RBAC integration: demo auth tokens include `health.rbac` permission')) {
      const marker = 'Default demo credentials:';
      if (readme.includes(marker)) {
        readme = readme.replace(
          marker,
          `- RBAC integration: demo auth tokens include \`health.rbac\` permission

Default demo credentials:`,
        );
      }
    }
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
    (group) => group.isAvailable(detected) && group.isPending(rootDir, detected),
  );
  const selected = Array.isArray(groupIds)
    ? available.filter((group) => groupIds.includes(group.id))
    : available;

  for (const group of selected) {
    summary.push({
      id: group.id,
      title: group.title,
      modules: getGroupParticipants(group),
      result: group.apply({ rootDir, packageRoot, changedFiles }),
    });
  }

  return {
    summary,
    availableGroups: available.map((group) => ({
      id: group.id,
      title: group.title,
      modules: [...getGroupParticipants(group)],
      description: [...getGroupDescription(group, detected)],
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
      group.isPending(rootDir, detected) &&
      (!relatedModuleId || getGroupRelatedModules(group).includes(relatedModuleId)),
  );
  return {
    groups: available.map((group) => ({
      id: group.id,
      title: group.title,
      modules: [...getGroupParticipants(group)],
      description: [...getGroupDescription(group, detected)],
    })),
  };
}
