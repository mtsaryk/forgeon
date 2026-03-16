import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive, writeJson } from '../utils/fs.mjs';
import {
  ensureBuildSteps,
  ensureDependency,
  ensureLineAfter,
  ensureLineBefore,
  upsertEnvLines,
} from './shared/patch-utils.mjs';
import { patchAppModuleRegistration, patchHealthControllerServiceProbe } from './shared/nest-runtime-wiring.mjs';
import { ensureWebProbeDefinition, resolveProbeTargets } from './shared/probes.mjs';

const JWT_AUTH_PERSISTENCE_MARKERS = {
  start: '<!-- forgeon:jwt-auth:persistence:start -->',
  end: '<!-- forgeon:jwt-auth:persistence:end -->',
};

const JWT_AUTH_RBAC_MARKERS = {
  start: '<!-- forgeon:jwt-auth:rbac:start -->',
  end: '<!-- forgeon:jwt-auth:rbac:end -->',
};

const JWT_AUTH_DEFAULT_PERSISTENCE_BLOCK = [
  '- refresh token persistence: disabled by default (stateless mode; enable it later through a `db-adapter` provider + integration sync)',
  '- to enable persistence later:',
  '  1. install a DB adapter provider first (current provider: `create-forgeon add db-prisma --project .`);',
  '  2. run `pnpm forgeon:sync-integrations` to wire auth persistence to the active DB adapter implementation.',
].join('\n');

const JWT_AUTH_DEFAULT_RBAC_BLOCK =
  '- RBAC integration: not enabled by default (add `rbac` and run `pnpm forgeon:sync-integrations` to include demo `health.rbac` claims).';

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
  patchAppModuleRegistration(targetRoot, {
    importLine: "import { authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';",
    loadItem: 'authConfig',
    envSchema: 'authEnvSchema',
    moduleLine: '    ForgeonAuthModule.register(),',
    beforeAnchors: [
      '    ForgeonI18nModule.register({',
    ],
    afterAnchors: [
      '    DbPrismaModule,',
      '    ForgeonLoggerModule,',
      '    ForgeonSwaggerModule,',
    ],
    fallbackAnchor: '    CoreErrorsModule,',
  });
}

function patchHealthController(targetRoot, probeTargets) {
  patchHealthControllerServiceProbe(targetRoot, probeTargets, {
    importLine: "import { AuthService } from '@forgeon/auth-api';",
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
      title: 'JWT Auth',
      buttonLabel: 'Check JWT auth probe',
      resultTitle: 'Auth probe response',
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

  const section = [
    '## JWT Auth Module',
    '',
    'The jwt-auth add-module provides:',
    '- `@forgeon/auth-contracts` shared auth routes/types/error codes',
    '- `@forgeon/auth-api` Nest auth module (`login`, `refresh`, `logout`, `me`)',
    '- JWT guard + passport strategy',
    '- auth probe endpoint: `GET /api/health/auth`',
    '',
    'Current mode:',
    JWT_AUTH_PERSISTENCE_MARKERS.start,
    JWT_AUTH_DEFAULT_PERSISTENCE_BLOCK,
    JWT_AUTH_PERSISTENCE_MARKERS.end,
    JWT_AUTH_RBAC_MARKERS.start,
    JWT_AUTH_DEFAULT_RBAC_BLOCK,
    JWT_AUTH_RBAC_MARKERS.end,
    '',
    'Default demo credentials:',
    '- `AUTH_DEMO_EMAIL=demo@forgeon.local`',
    '- `AUTH_DEMO_PASSWORD=forgeon-demo-password`',
    '',
    'Default routes:',
    '- `POST /api/auth/login`',
    '- `POST /api/auth/refresh`',
    '- `POST /api/auth/logout`',
    '- `GET /api/auth/me`',
  ].join('\n');

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

  const probeTargets = resolveProbeTargets({ targetRoot, moduleId: 'jwt-auth' });

  patchApiPackage(targetRoot);
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
