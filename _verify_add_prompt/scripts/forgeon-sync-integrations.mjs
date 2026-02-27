#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const PRISMA_AUTH_STORE_CONTENT = `import {
  AuthRefreshTokenStore,
} from '@forgeon/auth-api';
import { PrismaService } from '@forgeon/db-prisma';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PrismaAuthRefreshTokenStore implements AuthRefreshTokenStore {
  readonly kind = 'prisma';

  constructor(private readonly prisma: PrismaService) {}

  async saveRefreshTokenHash(subject: string, hash: string): Promise<void> {
    await this.prisma.user.upsert({
      where: { email: subject },
      create: { email: subject, refreshTokenHash: hash },
      update: { refreshTokenHash: hash },
      select: { id: true },
    });
  }

  async getRefreshTokenHash(subject: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: subject },
      select: { refreshTokenHash: true },
    });
    return user?.refreshTokenHash ?? null;
  }

  async removeRefreshTokenHash(subject: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { email: subject },
      data: { refreshTokenHash: null },
    });
  }
}
`;

const PRISMA_AUTH_MIGRATION_CONTENT = `-- AlterTable
ALTER TABLE "User"
ADD COLUMN "refreshTokenHash" TEXT;
`;

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

function syncJwtDbPrisma({ rootDir, changedFiles }) {
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
  const readmePath = path.join(rootDir, 'README.md');

  if (!fs.existsSync(appModulePath) || !fs.existsSync(schemaPath)) {
    return { applied: false, reason: 'app module or prisma schema is missing' };
  }

  let touched = false;

  if (!fs.existsSync(storePath)) {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, PRISMA_AUTH_STORE_CONTENT, 'utf8');
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
    fs.mkdirSync(path.dirname(migrationPath), { recursive: true });
    fs.writeFileSync(migrationPath, PRISMA_AUTH_MIGRATION_CONTENT, 'utf8');
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

function run() {
  const rootDir = process.cwd();
  const changedFiles = new Set();
  const detected = detectModules(rootDir);
  const summary = [];

  if (detected.jwtAuth && detected.dbPrisma) {
    summary.push({
      feature: 'jwt-auth + db-prisma',
      result: syncJwtDbPrisma({ rootDir, changedFiles }),
    });
  } else {
    summary.push({
      feature: 'jwt-auth + db-prisma',
      result: { applied: false, reason: 'required modules are not both installed' },
    });
  }

  console.log('[forgeon:sync-integrations] done');
  for (const item of summary) {
    if (item.result.applied) {
      console.log(`- ${item.feature}: applied`);
    } else {
      console.log(`- ${item.feature}: skipped (${item.result.reason})`);
    }
  }

  if (changedFiles.size > 0) {
    console.log('- changed files:');
    for (const filePath of [...changedFiles].sort()) {
      const relative = path.relative(rootDir, filePath);
      console.log(`  - ${relative}`);
    }
  }
}

run();
