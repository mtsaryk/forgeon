import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive, writeJson } from '../utils/fs.mjs';
import {
  ensureBuildSteps,
  ensureDependency,
  ensureLineAfter,
  ensureLineBefore,
  ensureLoadItem,
  ensureValidatorSchema,
  upsertEnvLines,
} from './shared/patch-utils.mjs';

function copyFromPreset(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'module-presets', 'jwt-auth', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing jwt-auth preset template: ${source}`);
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
  ensureDependency(packageJson, '@forgeon/auth-api', 'workspace:*');
  ensureDependency(packageJson, '@forgeon/auth-contracts', 'workspace:*');

  ensureBuildSteps(packageJson, 'predev', [
    'pnpm --filter @forgeon/auth-contracts build',
    'pnpm --filter @forgeon/auth-api build',
  ]);

  writeJson(packagePath, packageJson);
}

function patchAppModule(targetRoot) {
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes("from '@forgeon/auth-api';")) {
    if (content.includes("import { ForgeonI18nModule, i18nConfig, i18nEnvSchema } from '@forgeon/i18n';")) {
      content = ensureLineAfter(
        content,
        "import { ForgeonI18nModule, i18nConfig, i18nEnvSchema } from '@forgeon/i18n';",
        "import { authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';",
      );
    } else if (
      content.includes("import { ForgeonLoggerModule, loggerConfig, loggerEnvSchema } from '@forgeon/logger';")
    ) {
      content = ensureLineAfter(
        content,
        "import { ForgeonLoggerModule, loggerConfig, loggerEnvSchema } from '@forgeon/logger';",
        "import { authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';",
      );
    } else if (
      content.includes("import { ForgeonSwaggerModule, swaggerConfig, swaggerEnvSchema } from '@forgeon/swagger';")
    ) {
      content = ensureLineAfter(
        content,
        "import { ForgeonSwaggerModule, swaggerConfig, swaggerEnvSchema } from '@forgeon/swagger';",
        "import { authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';",
      );
    } else if (
      content.includes("import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';")
    ) {
      content = ensureLineAfter(
        content,
        "import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';",
        "import { authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';",
      );
    } else {
      content = ensureLineAfter(
        content,
        "import { ConfigModule } from '@nestjs/config';",
        "import { authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';",
      );
    }
  }

  content = ensureLoadItem(content, 'authConfig');
  content = ensureValidatorSchema(content, 'authEnvSchema');

  if (!content.includes('ForgeonAuthModule.register(')) {
    const moduleBlock = '    ForgeonAuthModule.register(),';

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
    const nestCommonImport = content.match(/import\s*\{[^}]*\}\s*from '@nestjs\/common';/m)?.[0];
    if (content.includes("import { PrismaService } from '@forgeon/db-prisma';")) {
      content = ensureLineAfter(
        content,
        "import { PrismaService } from '@forgeon/db-prisma';",
        "import { AuthService } from '@forgeon/auth-api';",
      );
    } else {
      content = ensureLineAfter(
        content,
        nestCommonImport ?? "import { Controller, Get } from '@nestjs/common';",
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
    } else {
      const classAnchor = 'export class HealthController {';
      if (content.includes(classAnchor)) {
        content = content.replace(
          classAnchor,
          `${classAnchor}
  constructor(private readonly authService: AuthService) {}
`,
        );
      }
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
      const classEnd = content.lastIndexOf('\n}');
      if (classEnd >= 0) {
        content = `${content.slice(0, classEnd).trimEnd()}\n\n${method}\n${content.slice(classEnd)}`;
      } else {
        content = `${content.trimEnd()}\n${method}\n`;
      }
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
  content = content
    .replace(/^\s*\{\/\* forgeon:probes:actions:start \*\/\}\r?\n?/gm, '')
    .replace(/^\s*\{\/\* forgeon:probes:actions:end \*\/\}\r?\n?/gm, '')
    .replace(/^\s*\{\/\* forgeon:probes:results:start \*\/\}\r?\n?/gm, '')
    .replace(/^\s*\{\/\* forgeon:probes:results:end \*\/\}\r?\n?/gm, '');

  if (!content.includes('authProbeResult')) {
    if (content.includes('  const [dbProbeResult, setDbProbeResult] = useState<ProbeResult | null>(null);')) {
      content = content.replace(
        '  const [dbProbeResult, setDbProbeResult] = useState<ProbeResult | null>(null);',
        `  const [dbProbeResult, setDbProbeResult] = useState<ProbeResult | null>(null);
  const [authProbeResult, setAuthProbeResult] = useState<ProbeResult | null>(null);`,
      );
    } else if (content.includes('  const [validationProbeResult, setValidationProbeResult] = useState<ProbeResult | null>(null);')) {
      content = content.replace(
        '  const [validationProbeResult, setValidationProbeResult] = useState<ProbeResult | null>(null);',
        `  const [validationProbeResult, setValidationProbeResult] = useState<ProbeResult | null>(null);
  const [authProbeResult, setAuthProbeResult] = useState<ProbeResult | null>(null);`,
      );
    }
  }

  if (!content.includes('Check JWT auth probe')) {
    const path = content.includes("runProbe(setHealthResult, '/health')") ? '/health/auth' : '/api/health/auth';
    const authButton = `        <button onClick={() => runProbe(setAuthProbeResult, '${path}')}>Check JWT auth probe</button>`;
    const actionsStart = content.indexOf('<div className="actions">');
    if (actionsStart >= 0) {
      const actionsEnd = content.indexOf('\n      </div>', actionsStart);
      if (actionsEnd >= 0) {
        content = `${content.slice(0, actionsEnd)}\n${authButton}${content.slice(actionsEnd)}`;
      }
    }
  }

  if (!content.includes("renderResult('Auth probe response', authProbeResult)")) {
    const authResultLine = "      {renderResult('Auth probe response', authProbeResult)}";
    const networkLine = '      {networkError ? <p className="error">{networkError}</p> : null}';
    if (content.includes(networkLine)) {
      content = content.replace(networkLine, `${authResultLine}\n${networkLine}`);
    } else if (content.includes("{renderResult('DB probe response', dbProbeResult)}")) {
      content = content.replace(
        "{renderResult('DB probe response', dbProbeResult)}",
        `{renderResult('DB probe response', dbProbeResult)}
      {renderResult('Auth probe response', authProbeResult)}`,
      );
    } else if (content.includes("{renderResult('Validation probe response', validationProbeResult)}")) {
      content = content.replace(
        "{renderResult('Validation probe response', validationProbeResult)}",
        `{renderResult('Validation probe response', validationProbeResult)}
      {renderResult('Auth probe response', authProbeResult)}`,
      );
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

function patchReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const persistenceSummary =
    '- refresh token persistence: disabled by default (stateless mode)';
  const dbFollowUp = `- to enable persistence later:
  1. install a DB module first (for now: \`create-forgeon add db-prisma --project .\`);
  2. run \`pnpm forgeon:sync-integrations\` to auto-wire pair integrations.`;

  const section = `## JWT Auth Module

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
- \`GET /api/auth/me\``;

  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  const sectionHeading = '## JWT Auth Module';
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

export function applyJwtAuthModule({ packageRoot, targetRoot }) {
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'auth-contracts'));
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'auth-api'));

  patchApiPackage(targetRoot);
  patchAppModule(targetRoot);
  patchHealthController(targetRoot);
  patchWebApp(targetRoot);
  patchApiDockerfile(targetRoot);
  patchCompose(targetRoot);
  patchReadme(targetRoot);

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
