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
  ensureLoadItem,
  ensureValidatorSchema,
  upsertEnvLines,
} from './shared/patch-utils.mjs';

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
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  content = ensureImportLine(
    content,
    "import { ForgeonSchedulerModule, schedulerConfig, schedulerEnvSchema } from '@forgeon/scheduler';",
  );
  content = ensureLoadItem(content, 'schedulerConfig');
  content = ensureValidatorSchema(content, 'schedulerEnvSchema');

  if (!content.includes('    ForgeonSchedulerModule,')) {
    if (content.includes('    ForgeonQueueModule,')) {
      content = ensureLineAfter(content, '    ForgeonQueueModule,', '    ForgeonSchedulerModule,');
    } else if (content.includes('    ForgeonI18nModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonI18nModule.register({', '    ForgeonSchedulerModule,');
    } else if (content.includes('    ForgeonAuthModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonAuthModule.register({', '    ForgeonSchedulerModule,');
    } else if (content.includes('    ForgeonAuthModule.register(),')) {
      content = ensureLineBefore(content, '    ForgeonAuthModule.register(),', '    ForgeonSchedulerModule,');
    } else if (content.includes('    DbPrismaModule,')) {
      content = ensureLineAfter(content, '    DbPrismaModule,', '    ForgeonSchedulerModule,');
    } else if (content.includes('    ForgeonLoggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonLoggerModule,', '    ForgeonSchedulerModule,');
    } else if (content.includes('    ForgeonSwaggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonSwaggerModule,', '    ForgeonSchedulerModule,');
    } else {
      content = ensureLineAfter(content, '    CoreErrorsModule,', '    ForgeonSchedulerModule,');
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
  content = ensureImportLine(content, "import { ForgeonSchedulerService } from '@forgeon/scheduler';");

  if (!content.includes('private readonly schedulerService: ForgeonSchedulerService')) {
    const constructorMatch = content.match(/constructor\(([\s\S]*?)\)\s*\{/m);
    if (constructorMatch) {
      const original = constructorMatch[0];
      const inner = constructorMatch[1].trimEnd();
      const normalizedInner = inner.replace(/,\s*$/, '');
      const separator = normalizedInner.length > 0 ? ',' : '';
      const next = `constructor(${normalizedInner}${separator}
    private readonly schedulerService: ForgeonSchedulerService,
  ) {`;
      content = content.replace(original, next);
    } else {
      const classAnchor = 'export class HealthController {';
      if (content.includes(classAnchor)) {
        content = content.replace(
          classAnchor,
          `${classAnchor}
  constructor(private readonly schedulerService: ForgeonSchedulerService) {}
`,
        );
      }
    }
  }

  if (!content.includes("@Get('scheduler')")) {
    const method = `
  @Get('scheduler')
  async getSchedulerProbe() {
    return this.schedulerService.getProbeStatus();
  }
`;
    content = ensureClassMember(content, 'HealthController', method, { beforeNeedle: 'private translate(' });
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

  if (!content.includes('schedulerProbeResult')) {
    const stateAnchors = [
      '  const [queueProbeResult, setQueueProbeResult] = useState<ProbeResult | null>(null);',
      '  const [filesImageProbeResult, setFilesImageProbeResult] = useState<ProbeResult | null>(null);',
      '  const [filesQuotasProbeResult, setFilesQuotasProbeResult] = useState<ProbeResult | null>(null);',
      '  const [filesAccessProbeResult, setFilesAccessProbeResult] = useState<ProbeResult | null>(null);',
      '  const [filesVariantsProbeResult, setFilesVariantsProbeResult] = useState<ProbeResult | null>(null);',
      '  const [filesProbeResult, setFilesProbeResult] = useState<ProbeResult | null>(null);',
      '  const [rbacProbeResult, setRbacProbeResult] = useState<ProbeResult | null>(null);',
      '  const [rateLimitProbeResult, setRateLimitProbeResult] = useState<ProbeResult | null>(null);',
      '  const [authProbeResult, setAuthProbeResult] = useState<ProbeResult | null>(null);',
      '  const [dbProbeResult, setDbProbeResult] = useState<ProbeResult | null>(null);',
      '  const [validationProbeResult, setValidationProbeResult] = useState<ProbeResult | null>(null);',
    ];
    const stateAnchor = stateAnchors.find((line) => content.includes(line));
    if (stateAnchor) {
      content = ensureLineAfter(
        content,
        stateAnchor,
        '  const [schedulerProbeResult, setSchedulerProbeResult] = useState<ProbeResult | null>(null);',
      );
    }
  }

  if (!content.includes('Check scheduler health')) {
    const probePath = content.includes("runProbe(setHealthResult, '/health')")
      ? '/health/scheduler'
      : '/api/health/scheduler';
    const button = `        <button onClick={() => runProbe(setSchedulerProbeResult, '${probePath}')}>
          Check scheduler health
        </button>`;

    const actionsStart = content.indexOf('<div className="actions">');
    if (actionsStart >= 0) {
      const actionsEnd = content.indexOf('\n      </div>', actionsStart);
      if (actionsEnd >= 0) {
        content = `${content.slice(0, actionsEnd)}\n${button}${content.slice(actionsEnd)}`;
      }
    }
  }

  if (!content.includes("{renderResult('Scheduler probe response', schedulerProbeResult)}")) {
    const resultLine = "      {renderResult('Scheduler probe response', schedulerProbeResult)}";
    const networkLine = '      {networkError ? <p className="error">{networkError}</p> : null}';
    if (content.includes(networkLine)) {
      content = content.replace(networkLine, `${resultLine}\n${networkLine}`);
    } else {
      const anchors = [
        "{renderResult('Queue probe response', queueProbeResult)}",
        "{renderResult('Files image probe response', filesImageProbeResult)}",
        "{renderResult('Files quotas probe response', filesQuotasProbeResult)}",
        "{renderResult('Files access probe response', filesAccessProbeResult)}",
        "{renderResult('Files variants probe response', filesVariantsProbeResult)}",
        "{renderResult('Files probe response', filesProbeResult)}",
        "{renderResult('RBAC probe response', rbacProbeResult)}",
        "{renderResult('Rate limit probe response', rateLimitProbeResult)}",
        "{renderResult('Auth probe response', authProbeResult)}",
        "{renderResult('DB probe response', dbProbeResult)}",
        "{renderResult('Validation probe response', validationProbeResult)}",
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

  patchApiPackage(targetRoot);
  patchAppModule(targetRoot);
  patchHealthController(targetRoot);
  patchWebApp(targetRoot);
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
