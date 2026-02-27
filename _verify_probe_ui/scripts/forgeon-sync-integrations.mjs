#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Project, QuoteKind } from 'ts-morph';

function hasAnyImport(sourceFile, moduleSpecifier) {
  return sourceFile.getImportDeclarations().some((item) => item.getModuleSpecifierValue() === moduleSpecifier);
}

function ensureNamedImports(sourceFile, moduleSpecifier, names) {
  const declaration = sourceFile
    .getImportDeclarations()
    .find((item) => item.getModuleSpecifierValue() === moduleSpecifier);

  if (!declaration) {
    sourceFile.addImportDeclaration({
      moduleSpecifier,
      namedImports: [...names].sort(),
    });
    return;
  }

  const existing = new Set(declaration.getNamedImports().map((item) => item.getName()));
  for (const name of names) {
    if (!existing.has(name)) {
      declaration.addNamedImport(name);
    }
  }
}

function hasDecorator(node, decoratorName) {
  return node.getDecorators().some((item) => item.getName() === decoratorName);
}

function addDecoratorIfMissing(node, decoratorName, args = []) {
  if (hasDecorator(node, decoratorName)) {
    return false;
  }
  node.addDecorator({
    name: decoratorName,
    arguments: args,
  });
  return true;
}

function syncJwtSwagger({ rootDir, changedFiles }) {
  const controllerPath = path.join(
    rootDir,
    'packages',
    'auth-api',
    'src',
    'auth.controller.ts',
  );
  const loginDtoPath = path.join(rootDir, 'packages', 'auth-api', 'src', 'dto', 'login.dto.ts');
  const refreshDtoPath = path.join(rootDir, 'packages', 'auth-api', 'src', 'dto', 'refresh.dto.ts');

  if (!fs.existsSync(controllerPath) || !fs.existsSync(loginDtoPath) || !fs.existsSync(refreshDtoPath)) {
    return { applied: false, reason: 'jwt-auth source files are missing' };
  }

  const project = new Project({
    manipulationSettings: { quoteKind: QuoteKind.Single },
    skipAddingFilesFromTsConfig: true,
  });

  const controller = project.addSourceFileAtPath(controllerPath);
  const loginDto = project.addSourceFileAtPath(loginDtoPath);
  const refreshDto = project.addSourceFileAtPath(refreshDtoPath);

  const controllerDecorators = [
    'ApiBearerAuth',
    'ApiBody',
    'ApiOkResponse',
    'ApiOperation',
    'ApiTags',
    'ApiUnauthorizedResponse',
  ];
  const dtoDecorators = ['ApiProperty'];

  ensureNamedImports(controller, '@nestjs/swagger', controllerDecorators);
  ensureNamedImports(loginDto, '@nestjs/swagger', dtoDecorators);
  ensureNamedImports(refreshDto, '@nestjs/swagger', dtoDecorators);

  const authController = controller.getClass('AuthController');
  if (!authController) {
    return { applied: false, reason: 'AuthController not found' };
  }

  addDecoratorIfMissing(authController, 'ApiTags', ["'auth'"]);

  const loginMethod = authController.getMethod('login');
  const refreshMethod = authController.getMethod('refresh');
  const logoutMethod = authController.getMethod('logout');
  const meMethod = authController.getMethod('me');

  if (loginMethod) {
    addDecoratorIfMissing(loginMethod, 'ApiOperation', ["{ summary: 'Authenticate demo user' }"]);
    addDecoratorIfMissing(loginMethod, 'ApiBody', ['{ type: LoginDto }']);
    addDecoratorIfMissing(loginMethod, 'ApiOkResponse', ["{ description: 'JWT token pair' }"]);
    addDecoratorIfMissing(loginMethod, 'ApiUnauthorizedResponse', ["{ description: 'Invalid credentials' }"]);
  }

  if (refreshMethod) {
    addDecoratorIfMissing(refreshMethod, 'ApiOperation', ["{ summary: 'Refresh access token' }"]);
    addDecoratorIfMissing(refreshMethod, 'ApiBody', ['{ type: RefreshDto }']);
    addDecoratorIfMissing(refreshMethod, 'ApiOkResponse', ["{ description: 'New JWT token pair' }"]);
    addDecoratorIfMissing(refreshMethod, 'ApiUnauthorizedResponse', [
      "{ description: 'Refresh token is invalid or expired' }",
    ]);
  }

  if (logoutMethod) {
    addDecoratorIfMissing(logoutMethod, 'ApiBearerAuth');
    addDecoratorIfMissing(logoutMethod, 'ApiOperation', ["{ summary: 'Logout and clear refresh token state' }"]);
    addDecoratorIfMissing(logoutMethod, 'ApiOkResponse', ["{ description: 'Logout accepted' }"]);
  }

  if (meMethod) {
    addDecoratorIfMissing(meMethod, 'ApiBearerAuth');
    addDecoratorIfMissing(meMethod, 'ApiOperation', ["{ summary: 'Get current authenticated user' }"]);
    addDecoratorIfMissing(meMethod, 'ApiOkResponse', ["{ description: 'Current user payload' }"]);
  }

  const loginDtoClass = loginDto.getClass('LoginDto');
  if (loginDtoClass) {
    const emailProp = loginDtoClass.getProperty('email');
    const passwordProp = loginDtoClass.getProperty('password');
    if (emailProp) {
      addDecoratorIfMissing(emailProp, 'ApiProperty', [
        "{ example: 'demo@forgeon.local', description: 'Demo account email' }",
      ]);
    }
    if (passwordProp) {
      addDecoratorIfMissing(passwordProp, 'ApiProperty', [
        "{ example: 'forgeon-demo-password', description: 'Demo account password' }",
      ]);
    }
  }

  const refreshDtoClass = refreshDto.getClass('RefreshDto');
  if (refreshDtoClass) {
    const tokenProp = refreshDtoClass.getProperty('refreshToken');
    if (tokenProp) {
      addDecoratorIfMissing(tokenProp, 'ApiProperty', [
        "{ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'Refresh token' }",
      ]);
    }
  }

  project.saveSync();
  changedFiles.add(controllerPath);
  changedFiles.add(loginDtoPath);
  changedFiles.add(refreshDtoPath);

  return { applied: true };
}

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

  if (appModule.includes("import { AUTH_REFRESH_TOKEN_STORE,")) {
    // already includes token symbol
  } else {
    appModule = appModule.replace(
      /import\s*\{([^}]*)\}\s*from '@forgeon\/auth-api';/m,
      (full, namesRaw) => {
        const names = namesRaw
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        if (!names.includes('AUTH_REFRESH_TOKEN_STORE')) {
          names.unshift('AUTH_REFRESH_TOKEN_STORE');
        }
        return `import { ${names.join(', ')} } from '@forgeon/auth-api';`;
      },
    );
  }

  const storeImportLine = "import { PrismaAuthRefreshTokenStore } from './auth/prisma-auth-refresh-token.store';";
  if (!appModule.includes(storeImportLine)) {
    const controllerImport = "import { HealthController } from './health/health.controller';";
    if (appModule.includes(controllerImport)) {
      appModule = appModule.replace(controllerImport, `${storeImportLine}\n${controllerImport}`);
    } else {
      appModule = `${appModule.trimEnd()}\n${storeImportLine}\n`;
    }
  }

  const authRegisterWithPrisma = `ForgeonAuthModule.register({
      imports: [DbPrismaModule],
      refreshTokenStoreProvider: {
        provide: AUTH_REFRESH_TOKEN_STORE,
        useClass: PrismaAuthRefreshTokenStore,
      },
    }),`;

  if (!appModule.includes('refreshTokenStoreProvider')) {
    if (/ForgeonAuthModule\.register\(\s*\),/.test(appModule)) {
      appModule = appModule.replace(/ForgeonAuthModule\.register\(\s*\),/, authRegisterWithPrisma);
    } else if (/ForgeonAuthModule\.register\(\{[\s\S]*?\}\),/m.test(appModule)) {
      appModule = appModule.replace(/ForgeonAuthModule\.register\(\{[\s\S]*?\}\),/m, authRegisterWithPrisma);
    }
  }

  if (appModule !== originalAppModule) {
    fs.writeFileSync(appModulePath, `${appModule.trimEnd()}\n`, 'utf8');
    changedFiles.add(appModulePath);
    touched = true;
  }

  let schema = fs.readFileSync(schemaPath, 'utf8').replace(/\r\n/g, '\n');
  const originalSchema = schema;
  if (!schema.includes('refreshTokenHash')) {
    schema = schema.replace(
      /email\s+String\s+@unique/g,
      'email            String   @unique\n  refreshTokenHash String?',
    );
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
      '- refresh token persistence: disabled (no supported DB adapter found)',
      '- refresh token persistence: enabled (`db-prisma` adapter)',
    );
    readme = readme.replace(
      /- to enable persistence later:[\s\S]*?2\. run `create-forgeon add jwt-auth --project \.` again to auto-wire the adapter\./m,
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

function detectModules(rootDir) {
  const appModulePath = path.join(rootDir, 'apps', 'api', 'src', 'app.module.ts');
  const appModuleText = fs.existsSync(appModulePath) ? fs.readFileSync(appModulePath, 'utf8') : '';

  return {
    swagger:
      fs.existsSync(path.join(rootDir, 'packages', 'swagger', 'package.json')) ||
      appModuleText.includes("from '@forgeon/swagger'"),
    jwtAuth:
      fs.existsSync(path.join(rootDir, 'packages', 'auth-api', 'package.json')) ||
      appModuleText.includes("from '@forgeon/auth-api'"),
    dbPrisma:
      fs.existsSync(path.join(rootDir, 'packages', 'db-prisma', 'package.json')) ||
      appModuleText.includes("from '@forgeon/db-prisma'"),
  };
}

function run() {
  const rootDir = process.cwd();
  const changedFiles = new Set();
  const detected = detectModules(rootDir);
  const summary = [];

  if (detected.swagger && detected.jwtAuth) {
    summary.push({
      feature: 'jwt-auth + swagger',
      result: syncJwtSwagger({ rootDir, changedFiles }),
    });
  } else {
    summary.push({
      feature: 'jwt-auth + swagger',
      result: { applied: false, reason: 'required modules are not both installed' },
    });
  }

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

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  run();
}
