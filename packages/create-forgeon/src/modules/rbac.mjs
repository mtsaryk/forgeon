import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive, writeJson } from '../utils/fs.mjs';
import {
  ensureBuildSteps,
  ensureClassMember,
  ensureDependency,
  ensureImportLine,
  ensureLineAfter,
  ensureLineBefore,
  ensureNestCommonImport,
} from './shared/patch-utils.mjs';

function copyFromPreset(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'module-presets', 'rbac', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing rbac preset template: ${source}`);
  }
  const destination = path.join(targetRoot, relativePath);
  copyRecursive(source, destination);
}

function patchApiPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'apps', 'api', 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  ensureDependency(packageJson, '@forgeon/rbac', 'workspace:*');
  ensureBuildSteps(packageJson, 'predev', ['pnpm --filter @forgeon/rbac build']);
  writeJson(packagePath, packageJson);
}

function patchAppModule(targetRoot) {
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes("from '@forgeon/rbac';")) {
    if (content.includes("import { ForgeonI18nModule, i18nConfig, i18nEnvSchema } from '@forgeon/i18n';")) {
      content = ensureLineAfter(
        content,
        "import { ForgeonI18nModule, i18nConfig, i18nEnvSchema } from '@forgeon/i18n';",
        "import { ForgeonRbacModule } from '@forgeon/rbac';",
      );
    } else if (
      content.includes("import { authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';")
    ) {
      content = ensureLineAfter(
        content,
        "import { authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';",
        "import { ForgeonRbacModule } from '@forgeon/rbac';",
      );
    } else if (
      content.includes("import { ForgeonRateLimitModule, rateLimitConfig, rateLimitEnvSchema } from '@forgeon/rate-limit';")
    ) {
      content = ensureLineAfter(
        content,
        "import { ForgeonRateLimitModule, rateLimitConfig, rateLimitEnvSchema } from '@forgeon/rate-limit';",
        "import { ForgeonRbacModule } from '@forgeon/rbac';",
      );
    } else if (
      content.includes("import { ForgeonLoggerModule, loggerConfig, loggerEnvSchema } from '@forgeon/logger';")
    ) {
      content = ensureLineAfter(
        content,
        "import { ForgeonLoggerModule, loggerConfig, loggerEnvSchema } from '@forgeon/logger';",
        "import { ForgeonRbacModule } from '@forgeon/rbac';",
      );
    } else if (
      content.includes("import { ForgeonSwaggerModule, swaggerConfig, swaggerEnvSchema } from '@forgeon/swagger';")
    ) {
      content = ensureLineAfter(
        content,
        "import { ForgeonSwaggerModule, swaggerConfig, swaggerEnvSchema } from '@forgeon/swagger';",
        "import { ForgeonRbacModule } from '@forgeon/rbac';",
      );
    } else if (
      content.includes("import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';")
    ) {
      content = ensureLineAfter(
        content,
        "import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';",
        "import { ForgeonRbacModule } from '@forgeon/rbac';",
      );
    } else {
      content = ensureLineAfter(
        content,
        "import { ConfigModule } from '@nestjs/config';",
        "import { ForgeonRbacModule } from '@forgeon/rbac';",
      );
    }
  }

  if (!content.includes('    ForgeonRbacModule,')) {
    if (content.includes('    ForgeonI18nModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonI18nModule.register({', '    ForgeonRbacModule,');
    } else if (content.includes('    ForgeonAuthModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonAuthModule.register({', '    ForgeonRbacModule,');
    } else if (content.includes('    ForgeonAuthModule.register(),')) {
      content = ensureLineBefore(content, '    ForgeonAuthModule.register(),', '    ForgeonRbacModule,');
    } else if (content.includes('    ForgeonRateLimitModule,')) {
      content = ensureLineAfter(content, '    ForgeonRateLimitModule,', '    ForgeonRbacModule,');
    } else if (content.includes('    DbPrismaModule,')) {
      content = ensureLineAfter(content, '    DbPrismaModule,', '    ForgeonRbacModule,');
    } else if (content.includes('    ForgeonLoggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonLoggerModule,', '    ForgeonRbacModule,');
    } else if (content.includes('    ForgeonSwaggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonSwaggerModule,', '    ForgeonRbacModule,');
    } else {
      content = ensureLineAfter(content, '    CoreErrorsModule,', '    ForgeonRbacModule,');
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
  content = ensureNestCommonImport(content, 'UseGuards');

  if (!content.includes("from '@forgeon/rbac';")) {
    content = ensureImportLine(
      content,
      "import { ForgeonRbacGuard, Permissions } from '@forgeon/rbac';",
    );
  }

  if (!content.includes("@Get('rbac')")) {
    const method = `
  @Get('rbac')
  @UseGuards(ForgeonRbacGuard)
  @Permissions('health.rbac')
  getRbacProbe() {
    return {
      status: 'ok',
      feature: 'rbac',
      granted: true,
      requiredPermission: 'health.rbac',
      hint: 'Send x-forgeon-permissions: health.rbac to pass this check manually.',
    };
  }
`;
    const beforeNeedle = content.includes("@Get('rate-limit')")
      ? "@Get('rate-limit')"
      : content.includes('private translate(')
        ? 'private translate('
        : '';
    content = ensureClassMember(content, 'HealthController', method, { beforeNeedle });
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

  if (!content.includes('rbacProbeResult')) {
    const stateAnchors = [
      '  const [rateLimitProbeResult, setRateLimitProbeResult] = useState<ProbeResult | null>(null);',
      '  const [dbProbeResult, setDbProbeResult] = useState<ProbeResult | null>(null);',
      '  const [authProbeResult, setAuthProbeResult] = useState<ProbeResult | null>(null);',
      '  const [validationProbeResult, setValidationProbeResult] = useState<ProbeResult | null>(null);',
    ];
    const stateAnchor = stateAnchors.find((line) => content.includes(line));
    if (stateAnchor) {
      content = ensureLineAfter(
        content,
        stateAnchor,
        '  const [rbacProbeResult, setRbacProbeResult] = useState<ProbeResult | null>(null);',
      );
    }
  }

  if (!content.includes('Check RBAC access')) {
    const useProxyPath = content.includes("runProbe(setHealthResult, '/health')");
    const probePath = useProxyPath ? '/health/rbac' : '/api/health/rbac';
    const button = `        <button\n          onClick={() =>\n            runProbe(setRbacProbeResult, '${probePath}', {\n              headers: { 'x-forgeon-permissions': 'health.rbac' },\n            })\n          }\n        >\n          Check RBAC access\n        </button>`;

    const actionsStart = content.indexOf('<div className="actions">');
    if (actionsStart >= 0) {
      const actionsEnd = content.indexOf('\n      </div>', actionsStart);
      if (actionsEnd >= 0) {
        content = `${content.slice(0, actionsEnd)}\n${button}${content.slice(actionsEnd)}`;
      }
    }
  }

  if (!content.includes("{renderResult('RBAC probe response', rbacProbeResult)}")) {
    const resultLine = "      {renderResult('RBAC probe response', rbacProbeResult)}";
    const networkLine = '      {networkError ? <p className="error">{networkError}</p> : null}';
    if (content.includes(networkLine)) {
      content = content.replace(networkLine, `${resultLine}\n${networkLine}`);
    } else {
      const anchors = [
        "      {renderResult('Rate limit probe response', rateLimitProbeResult)}",
        "      {renderResult('Auth probe response', authProbeResult)}",
        "      {renderResult('DB probe response', dbProbeResult)}",
        "      {renderResult('Validation probe response', validationProbeResult)}",
      ];
      const anchor = anchors.find((line) => content.includes(line));
      if (anchor) {
        content = ensureLineAfter(content, anchor, resultLine);
      }
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
    'COPY packages/auth-api/package.json packages/auth-api/package.json',
    'COPY packages/rate-limit/package.json packages/rate-limit/package.json',
    'COPY packages/logger/package.json packages/logger/package.json',
    'COPY packages/swagger/package.json packages/swagger/package.json',
    'COPY packages/i18n/package.json packages/i18n/package.json',
    'COPY packages/db-prisma/package.json packages/db-prisma/package.json',
    'COPY packages/core/package.json packages/core/package.json',
  ];
  const packageAnchor = packageAnchors.find((line) => content.includes(line)) ?? packageAnchors.at(-1);
  content = ensureLineAfter(content, packageAnchor, 'COPY packages/rbac/package.json packages/rbac/package.json');

  const sourceAnchors = [
    'COPY packages/auth-api packages/auth-api',
    'COPY packages/rate-limit packages/rate-limit',
    'COPY packages/logger packages/logger',
    'COPY packages/swagger packages/swagger',
    'COPY packages/i18n packages/i18n',
    'COPY packages/db-prisma packages/db-prisma',
    'COPY packages/core packages/core',
  ];
  const sourceAnchor = sourceAnchors.find((line) => content.includes(line)) ?? sourceAnchors.at(-1);
  content = ensureLineAfter(content, sourceAnchor, 'COPY packages/rbac packages/rbac');

  content = content.replace(/^RUN pnpm --filter @forgeon\/rbac build\r?\n?/gm, '');
  const buildAnchor = content.includes('RUN pnpm --filter @forgeon/api prisma:generate')
    ? 'RUN pnpm --filter @forgeon/api prisma:generate'
    : 'RUN pnpm --filter @forgeon/api build';
  content = ensureLineBefore(content, buildAnchor, 'RUN pnpm --filter @forgeon/rbac build');

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const marker = '## RBAC / Permissions Module';
  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  if (content.includes(marker)) {
    return;
  }

  const section = `## RBAC / Permissions Module

The rbac add-module provides a minimal authorization layer for role and permission checks.

What it adds:
- \`@Roles(...)\` and \`@Permissions(...)\` decorators
- \`ForgeonRbacGuard\`
- simple helper functions for role / permission checks
- a protected probe route: \`GET /api/health/rbac\`

How it works:
- the guard reads metadata from decorators
- it checks \`request.user\` first
- if no user payload is present, it can also read test headers:
  - \`x-forgeon-roles\`
  - \`x-forgeon-permissions\`

How to verify:
- the generated frontend button sends \`x-forgeon-permissions: health.rbac\` and should return \`200\`
- the same route without that header should return \`403\`

Current scope:
- no policy engine
- no database-backed role store
- no frontend route-guard layer in this module`;

  if (content.includes('## Prisma In Docker Start')) {
    content = content.replace('## Prisma In Docker Start', `${section}\n\n## Prisma In Docker Start`);
  } else {
    content = `${content.trimEnd()}\n\n${section}\n`;
  }

  fs.writeFileSync(readmePath, `${content.trimEnd()}\n`, 'utf8');
}

export function applyRbacModule({ packageRoot, targetRoot }) {
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'rbac'));
  patchApiPackage(targetRoot);
  patchAppModule(targetRoot);
  patchHealthController(targetRoot);
  patchWebApp(targetRoot);
  patchApiDockerfile(targetRoot);
  patchReadme(targetRoot);
}
