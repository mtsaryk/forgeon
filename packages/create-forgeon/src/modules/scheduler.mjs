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

function copyFromPreset(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'module-presets', 'scheduler', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing scheduler preset template: ${source}`);
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
  ensureDependency(packageJson, '@forgeon/scheduler', 'workspace:*');
  ensureBuildSteps(packageJson, 'predev', ['pnpm --filter @forgeon/scheduler build']);
  writeJson(packagePath, packageJson);
}

function patchAppModule(targetRoot) {
  patchAppModuleRegistration(targetRoot, {
    importLine: "import { ForgeonSchedulerModule, schedulerConfig, schedulerEnvSchema } from '@forgeon/scheduler';",
    loadItem: 'schedulerConfig',
    envSchema: 'schedulerEnvSchema',
    moduleLine: '    ForgeonSchedulerModule,',
    beforeAnchors: [
      '    ForgeonI18nModule.register({',
      '    ForgeonAuthModule.register({',
      '    ForgeonAuthModule.register(),',
    ],
    afterAnchors: [
      '    ForgeonQueueModule,',
      '    DbPrismaModule,',
      '    ForgeonLoggerModule,',
      '    ForgeonSwaggerModule,',
    ],
  });
}

function patchHealthController(targetRoot, probeTargets) {
  patchHealthControllerServiceProbe(targetRoot, probeTargets, {
    importLine: "import { ForgeonSchedulerService } from '@forgeon/scheduler';",
    constructorMember: 'private readonly schedulerService: ForgeonSchedulerService',
    routePath: 'scheduler',
    methodName: 'getSchedulerProbe',
    serviceCall: 'this.schedulerService.getProbeStatus()',
  });
}

function registerWebProbe(targetRoot, probeTargets) {
  ensureWebProbeDefinition({
    targetRoot,
    probeTargets,
    definition: {
      id: 'scheduler',
      title: 'Scheduler',
      buttonLabel: 'Check scheduler health',
      resultTitle: 'Scheduler probe response',
      path: '/health/scheduler',
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
    'COPY packages/scheduler/package.json packages/scheduler/package.json',
    'COPY packages/queue/package.json packages/queue/package.json',
    'COPY packages/files-image/package.json packages/files-image/package.json',
    'COPY packages/files-quotas/package.json packages/files-quotas/package.json',
    'COPY packages/files-access/package.json packages/files-access/package.json',
    'COPY packages/files-s3/package.json packages/files-s3/package.json',
    'COPY packages/files-local/package.json packages/files-local/package.json',
    'COPY packages/files/package.json packages/files/package.json',
    'COPY packages/auth-api/package.json packages/auth-api/package.json',
    'COPY packages/rbac/package.json packages/rbac/package.json',
    'COPY packages/rate-limit/package.json packages/rate-limit/package.json',
    'COPY packages/logger/package.json packages/logger/package.json',
    'COPY packages/swagger/package.json packages/swagger/package.json',
    'COPY packages/i18n/package.json packages/i18n/package.json',
    'COPY packages/db-prisma/package.json packages/db-prisma/package.json',
    'COPY packages/core/package.json packages/core/package.json',
  ];
  const packageAnchor = packageAnchors.find((line) => content.includes(line)) ?? packageAnchors.at(-1);
  content = ensureLineAfter(content, packageAnchor, 'COPY packages/scheduler/package.json packages/scheduler/package.json');

  const sourceAnchors = [
    'COPY packages/scheduler packages/scheduler',
    'COPY packages/queue packages/queue',
    'COPY packages/files-image packages/files-image',
    'COPY packages/files-quotas packages/files-quotas',
    'COPY packages/files-access packages/files-access',
    'COPY packages/files-s3 packages/files-s3',
    'COPY packages/files-local packages/files-local',
    'COPY packages/files packages/files',
    'COPY packages/auth-api packages/auth-api',
    'COPY packages/rbac packages/rbac',
    'COPY packages/rate-limit packages/rate-limit',
    'COPY packages/logger packages/logger',
    'COPY packages/swagger packages/swagger',
    'COPY packages/i18n packages/i18n',
    'COPY packages/db-prisma packages/db-prisma',
    'COPY packages/core packages/core',
  ];
  const sourceAnchor = sourceAnchors.find((line) => content.includes(line)) ?? sourceAnchors.at(-1);
  content = ensureLineAfter(content, sourceAnchor, 'COPY packages/scheduler packages/scheduler');

  content = content.replace(/^RUN pnpm --filter @forgeon\/scheduler build\r?\n?/gm, '');
  if (content.includes('RUN pnpm --filter @forgeon/queue build')) {
    content = ensureLineAfter(content, 'RUN pnpm --filter @forgeon/queue build', 'RUN pnpm --filter @forgeon/scheduler build');
  } else {
    const buildAnchor = content.includes('RUN pnpm --filter @forgeon/api prisma:generate')
      ? 'RUN pnpm --filter @forgeon/api prisma:generate'
      : 'RUN pnpm --filter @forgeon/api build';
    content = ensureLineBefore(content, buildAnchor, 'RUN pnpm --filter @forgeon/scheduler build');
  }

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchCompose(targetRoot) {
  const composePath = path.join(targetRoot, 'infra', 'docker', 'compose.yml');
  if (!fs.existsSync(composePath)) {
    return;
  }

  let content = fs.readFileSync(composePath, 'utf8').replace(/\r\n/g, '\n');

  if (!content.includes('SCHEDULER_ENABLED: ${SCHEDULER_ENABLED}')) {
    const anchors = [
      /^(\s+QUEUE_DEFAULT_BACKOFF_MS:.*)$/m,
      /^(\s+FILES_IMAGE_STRIP_METADATA:.*)$/m,
      /^(\s+FILES_QUOTA_MAX_BYTES_PER_OWNER:.*)$/m,
      /^(\s+FILES_ACCESS_DEFAULT_VISIBILITY:.*)$/m,
      /^(\s+FILES_S3_MAX_ATTEMPTS:.*)$/m,
      /^(\s+FILES_LOCAL_ROOT:.*)$/m,
      /^(\s+FILES_PUBLIC_BASE_PATH:.*)$/m,
      /^(\s+AUTH_DEMO_PASSWORD:.*)$/m,
      /^(\s+THROTTLE_TRUST_PROXY:.*)$/m,
      /^(\s+LOGGER_REQUEST_ID_HEADER:.*)$/m,
      /^(\s+SWAGGER_DOCS_PATH:.*)$/m,
      /^(\s+I18N_FALLBACK_LANG:.*)$/m,
      /^(\s+DATABASE_URL:.*)$/m,
      /^(\s+API_PREFIX:.*)$/m,
    ];
    const anchorPattern = anchors.find((pattern) => pattern.test(content)) ?? anchors.at(-1);
    content = content.replace(
      anchorPattern,
      `$1
      SCHEDULER_ENABLED: \${SCHEDULER_ENABLED}
      SCHEDULER_TIMEZONE: \${SCHEDULER_TIMEZONE}
      SCHEDULER_HEARTBEAT_CRON: \${SCHEDULER_HEARTBEAT_CRON}`,
    );
  }

  fs.writeFileSync(composePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const marker = '## Scheduler Module';
  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  if (content.includes(marker)) {
    return;
  }

  const section = `## Scheduler Module

The scheduler add-module provides cron-based orchestration on top of the queue foundation.

What it adds:
- \`@forgeon/scheduler\` package
- typed scheduler env config (module-owned)
- scheduler probe endpoint: \`GET /api/health/scheduler\`
- web probe button for quick runtime verification
- fixed-id heartbeat scheduling to avoid unbounded queue growth before worker support exists

Configuration (env):
- \`SCHEDULER_ENABLED=true\`
- \`SCHEDULER_TIMEZONE=UTC\`
- \`SCHEDULER_HEARTBEAT_CRON=*/5 * * * *\`

Operational notes:
- this stage owns cron orchestration only
- queue remains responsible for broker/runtime delivery
- worker execution is intentionally deferred to a later module`;

  if (content.includes('## Queue Module')) {
    content = content.replace('## Queue Module', `${section}\n\n## Queue Module`);
  } else if (content.includes('## Prisma In Docker Start')) {
    content = content.replace('## Prisma In Docker Start', `${section}\n\n## Prisma In Docker Start`);
  } else {
    content = `${content.trimEnd()}\n\n${section}\n`;
  }

  fs.writeFileSync(readmePath, `${content.trimEnd()}\n`, 'utf8');
}

export function applySchedulerModule({ packageRoot, targetRoot }) {
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'scheduler'));
  const probeTargets = resolveProbeTargets({ targetRoot, moduleId: 'scheduler' });

  patchApiPackage(targetRoot);
  patchAppModule(targetRoot);
  patchHealthController(targetRoot, probeTargets);
  registerWebProbe(targetRoot, probeTargets);
  patchApiDockerfile(targetRoot);
  patchCompose(targetRoot);
  patchReadme(targetRoot);

  upsertEnvLines(path.join(targetRoot, 'apps', 'api', '.env.example'), [
    'SCHEDULER_ENABLED=true',
    'SCHEDULER_TIMEZONE=UTC',
    'SCHEDULER_HEARTBEAT_CRON=*/5 * * * *',
  ]);
  upsertEnvLines(path.join(targetRoot, 'infra', 'docker', '.env.example'), [
    'SCHEDULER_ENABLED=true',
    'SCHEDULER_TIMEZONE=UTC',
    'SCHEDULER_HEARTBEAT_CRON=*/5 * * * *',
  ]);
}
