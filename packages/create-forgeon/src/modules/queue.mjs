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
  const source = path.join(packageRoot, 'templates', 'module-presets', 'queue', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing queue preset template: ${source}`);
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
  ensureDependency(packageJson, '@forgeon/queue', 'workspace:*');
  ensureBuildSteps(packageJson, 'predev', ['pnpm --filter @forgeon/queue build']);
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
    "import { ForgeonQueueModule, queueConfig, queueEnvSchema } from '@forgeon/queue';",
  );
  content = ensureLoadItem(content, 'queueConfig');
  content = ensureValidatorSchema(content, 'queueEnvSchema');

  if (!content.includes('    ForgeonQueueModule,')) {
    if (content.includes('    ForgeonI18nModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonI18nModule.register({', '    ForgeonQueueModule,');
    } else if (content.includes('    ForgeonAuthModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonAuthModule.register({', '    ForgeonQueueModule,');
    } else if (content.includes('    ForgeonAuthModule.register(),')) {
      content = ensureLineBefore(content, '    ForgeonAuthModule.register(),', '    ForgeonQueueModule,');
    } else if (content.includes('    DbPrismaModule,')) {
      content = ensureLineAfter(content, '    DbPrismaModule,', '    ForgeonQueueModule,');
    } else if (content.includes('    ForgeonLoggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonLoggerModule,', '    ForgeonQueueModule,');
    } else if (content.includes('    ForgeonSwaggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonSwaggerModule,', '    ForgeonQueueModule,');
    } else {
      content = ensureLineAfter(content, '    CoreErrorsModule,', '    ForgeonQueueModule,');
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
  content = ensureImportLine(content, "import { QueueService } from '@forgeon/queue';");

  if (!content.includes('private readonly queueService: QueueService')) {
    const constructorMatch = content.match(/constructor\(([\s\S]*?)\)\s*\{/m);
    if (constructorMatch) {
      const original = constructorMatch[0];
      const inner = constructorMatch[1].trimEnd();
      const normalizedInner = inner.replace(/,\s*$/, '');
      const separator = normalizedInner.length > 0 ? ',' : '';
      const next = `constructor(${normalizedInner}${separator}
    private readonly queueService: QueueService,
  ) {`;
      content = content.replace(original, next);
    } else {
      const classAnchor = 'export class HealthController {';
      if (content.includes(classAnchor)) {
        content = content.replace(
          classAnchor,
          `${classAnchor}
  constructor(private readonly queueService: QueueService) {}
`,
        );
      }
    }
  }

  if (!content.includes("@Get('queue')")) {
    const method = `
  @Get('queue')
  async getQueueProbe() {
    return this.queueService.getProbeStatus();
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

  if (!content.includes('queueProbeResult')) {
    const stateAnchors = [
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
        '  const [queueProbeResult, setQueueProbeResult] = useState<ProbeResult | null>(null);',
      );
    }
  }

  if (!content.includes('Check queue health')) {
    const probePath = content.includes("runProbe(setHealthResult, '/health')")
      ? '/health/queue'
      : '/api/health/queue';
    const button = `        <button onClick={() => runProbe(setQueueProbeResult, '${probePath}')}>\n          Check queue health\n        </button>`;

    const actionsStart = content.indexOf('<div className="actions">');
    if (actionsStart >= 0) {
      const actionsEnd = content.indexOf('\n      </div>', actionsStart);
      if (actionsEnd >= 0) {
        content = `${content.slice(0, actionsEnd)}\n${button}${content.slice(actionsEnd)}`;
      }
    }
  }

  if (!content.includes("{renderResult('Queue probe response', queueProbeResult)}")) {
    const resultLine = "      {renderResult('Queue probe response', queueProbeResult)}";
    const networkLine = '      {networkError ? <p className="error">{networkError}</p> : null}';
    if (content.includes(networkLine)) {
      content = content.replace(networkLine, `${resultLine}\n${networkLine}`);
    } else {
      const anchors = [
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
  content = ensureLineAfter(content, packageAnchor, 'COPY packages/queue/package.json packages/queue/package.json');

  const sourceAnchors = [
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
  content = ensureLineAfter(content, sourceAnchor, 'COPY packages/queue packages/queue');

  content = content.replace(/^RUN pnpm --filter @forgeon\/queue build\r?\n?/gm, '');
  const buildAnchor = content.includes('RUN pnpm --filter @forgeon/api prisma:generate')
    ? 'RUN pnpm --filter @forgeon/api prisma:generate'
    : 'RUN pnpm --filter @forgeon/api build';
  content = ensureLineBefore(content, buildAnchor, 'RUN pnpm --filter @forgeon/queue build');

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchCompose(targetRoot) {
  const composePath = path.join(targetRoot, 'infra', 'docker', 'compose.yml');
  if (!fs.existsSync(composePath)) {
    return;
  }

  let content = fs.readFileSync(composePath, 'utf8').replace(/\r\n/g, '\n');

  const redisServiceBlock = `  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--save", "", "--appendonly", "no"]
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10`;

  if (!/\n\s{2}redis:\n/.test(content)) {
    content = content.replace(/^services:\n/m, `services:\n${redisServiceBlock}\n\n`);
  }

  if (!content.includes('QUEUE_ENABLED: ${QUEUE_ENABLED}')) {
    const anchors = [
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
      QUEUE_ENABLED: \${QUEUE_ENABLED}
      QUEUE_REDIS_URL: \${QUEUE_REDIS_URL}
      QUEUE_PREFIX: \${QUEUE_PREFIX}
      QUEUE_DEFAULT_ATTEMPTS: \${QUEUE_DEFAULT_ATTEMPTS}
      QUEUE_DEFAULT_BACKOFF_MS: \${QUEUE_DEFAULT_BACKOFF_MS}`,
    );
  }

  const apiBlockMatch = content.match(/^  api:\n[\s\S]*?(?=^  [a-zA-Z0-9_-]+:\n|^volumes:\n|$)/m);
  if (apiBlockMatch) {
    let apiBlock = apiBlockMatch[0];
    if (!/^\s{6}redis:\s*$/m.test(apiBlock) && !/^\s{6}-\s*redis\s*$/m.test(apiBlock)) {
      if (/^\s{4}depends_on:\s*$/m.test(apiBlock)) {
        if (/^\s{6}-\s+/m.test(apiBlock)) {
          apiBlock = apiBlock.replace(
            /^(\s{4}depends_on:\n(?:\s{6}-\s+.+\n)+)/m,
            `$1      - redis
`,
          );
        } else {
          apiBlock = apiBlock.replace(
            /^(\s{4}depends_on:\n)/m,
            `$1      redis:
        condition: service_healthy
`,
          );
        }
      } else {
        const withDependsOn = apiBlock.replace(
          /^(\s{4}environment:\n(?:\s{6}.+\n)+)/m,
          `$1    depends_on:
      redis:
        condition: service_healthy
`,
        );
        apiBlock =
          withDependsOn === apiBlock
            ? `${apiBlock.trimEnd()}\n    depends_on:\n      redis:\n        condition: service_healthy\n`
            : withDependsOn;
      }
    }
    content = content.replace(apiBlockMatch[0], apiBlock);
  }

  fs.writeFileSync(composePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const marker = '## Queue Module';
  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  if (content.includes(marker)) {
    return;
  }

  const section = `## Queue Module

The queue add-module provides an async job runtime baseline backed by Redis.

What it adds:
- \`@forgeon/queue\` package
- typed queue env config (module-owned)
- queue probe endpoint: \`GET /api/health/queue\`
- web probe button for quick runtime verification
- Redis service wiring in Docker Compose

Configuration (env):
- \`QUEUE_ENABLED=true\`
- \`QUEUE_REDIS_URL=redis://localhost:6379\`
- \`QUEUE_PREFIX=forgeon\`
- \`QUEUE_DEFAULT_ATTEMPTS=3\`
- \`QUEUE_DEFAULT_BACKOFF_MS=1000\`

Operational notes:
- this stage is the queue foundation (runtime + connectivity)
- worker/cron orchestration is intentionally deferred to later modules`;

  if (content.includes('## Prisma In Docker Start')) {
    content = content.replace('## Prisma In Docker Start', `${section}\n\n## Prisma In Docker Start`);
  } else {
    content = `${content.trimEnd()}\n\n${section}\n`;
  }

  fs.writeFileSync(readmePath, `${content.trimEnd()}\n`, 'utf8');
}

export function applyQueueModule({ packageRoot, targetRoot }) {
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'queue'));

  patchApiPackage(targetRoot);
  patchAppModule(targetRoot);
  patchHealthController(targetRoot);
  patchWebApp(targetRoot);
  patchApiDockerfile(targetRoot);
  patchCompose(targetRoot);
  patchReadme(targetRoot);

  upsertEnvLines(path.join(targetRoot, 'apps', 'api', '.env.example'), [
    'QUEUE_ENABLED=true',
    'QUEUE_REDIS_URL=redis://localhost:6379',
    'QUEUE_PREFIX=forgeon',
    'QUEUE_DEFAULT_ATTEMPTS=3',
    'QUEUE_DEFAULT_BACKOFF_MS=1000',
  ]);
  upsertEnvLines(path.join(targetRoot, 'infra', 'docker', '.env.example'), [
    'QUEUE_ENABLED=true',
    'QUEUE_REDIS_URL=redis://redis:6379',
    'QUEUE_PREFIX=forgeon',
    'QUEUE_DEFAULT_ATTEMPTS=3',
    'QUEUE_DEFAULT_BACKOFF_MS=1000',
  ]);
}
