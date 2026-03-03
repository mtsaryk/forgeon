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
  const source = path.join(packageRoot, 'templates', 'module-presets', 'rate-limit', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing rate-limit preset template: ${source}`);
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
  ensureDependency(packageJson, '@forgeon/rate-limit', 'workspace:*');
  ensureBuildSteps(packageJson, 'predev', ['pnpm --filter @forgeon/rate-limit build']);
  writeJson(packagePath, packageJson);
}

function patchAppModule(targetRoot) {
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes("from '@forgeon/rate-limit';")) {
    if (content.includes("import { ForgeonI18nModule, i18nConfig, i18nEnvSchema } from '@forgeon/i18n';")) {
      content = ensureLineAfter(
        content,
        "import { ForgeonI18nModule, i18nConfig, i18nEnvSchema } from '@forgeon/i18n';",
        "import { ForgeonRateLimitModule, rateLimitConfig, rateLimitEnvSchema } from '@forgeon/rate-limit';",
      );
    } else if (
      content.includes("import { authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';")
    ) {
      content = ensureLineAfter(
        content,
        "import { authConfig, authEnvSchema, ForgeonAuthModule } from '@forgeon/auth-api';",
        "import { ForgeonRateLimitModule, rateLimitConfig, rateLimitEnvSchema } from '@forgeon/rate-limit';",
      );
    } else if (
      content.includes("import { ForgeonLoggerModule, loggerConfig, loggerEnvSchema } from '@forgeon/logger';")
    ) {
      content = ensureLineAfter(
        content,
        "import { ForgeonLoggerModule, loggerConfig, loggerEnvSchema } from '@forgeon/logger';",
        "import { ForgeonRateLimitModule, rateLimitConfig, rateLimitEnvSchema } from '@forgeon/rate-limit';",
      );
    } else if (
      content.includes("import { ForgeonSwaggerModule, swaggerConfig, swaggerEnvSchema } from '@forgeon/swagger';")
    ) {
      content = ensureLineAfter(
        content,
        "import { ForgeonSwaggerModule, swaggerConfig, swaggerEnvSchema } from '@forgeon/swagger';",
        "import { ForgeonRateLimitModule, rateLimitConfig, rateLimitEnvSchema } from '@forgeon/rate-limit';",
      );
    } else if (
      content.includes("import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';")
    ) {
      content = ensureLineAfter(
        content,
        "import { dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule } from '@forgeon/db-prisma';",
        "import { ForgeonRateLimitModule, rateLimitConfig, rateLimitEnvSchema } from '@forgeon/rate-limit';",
      );
    } else {
      content = ensureLineAfter(
        content,
        "import { ConfigModule } from '@nestjs/config';",
        "import { ForgeonRateLimitModule, rateLimitConfig, rateLimitEnvSchema } from '@forgeon/rate-limit';",
      );
    }
  }

  content = ensureLoadItem(content, 'rateLimitConfig');
  content = ensureValidatorSchema(content, 'rateLimitEnvSchema');

  if (!content.includes('    ForgeonRateLimitModule,')) {
    if (content.includes('    ForgeonI18nModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonI18nModule.register({', '    ForgeonRateLimitModule,');
    } else if (content.includes('    ForgeonAuthModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonAuthModule.register({', '    ForgeonRateLimitModule,');
    } else if (content.includes('    ForgeonAuthModule.register(),')) {
      content = ensureLineBefore(content, '    ForgeonAuthModule.register(),', '    ForgeonRateLimitModule,');
    } else if (content.includes('    DbPrismaModule,')) {
      content = ensureLineAfter(content, '    DbPrismaModule,', '    ForgeonRateLimitModule,');
    } else if (content.includes('    ForgeonLoggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonLoggerModule,', '    ForgeonRateLimitModule,');
    } else if (content.includes('    ForgeonSwaggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonSwaggerModule,', '    ForgeonRateLimitModule,');
    } else {
      content = ensureLineAfter(content, '    CoreErrorsModule,', '    ForgeonRateLimitModule,');
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
  if (!content.includes("@Get('rate-limit')")) {
    const method = `
  @Get('rate-limit')
  getRateLimitProbe() {
    return {
      status: 'ok',
      feature: 'rate-limit',
      hint: 'Repeat this request quickly to trigger TOO_MANY_REQUESTS.',
    };
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

  if (!content.includes('rateLimitProbeResult')) {
    const stateAnchors = [
      '  const [dbProbeResult, setDbProbeResult] = useState<ProbeResult | null>(null);',
      '  const [authProbeResult, setAuthProbeResult] = useState<ProbeResult | null>(null);',
      '  const [validationProbeResult, setValidationProbeResult] = useState<ProbeResult | null>(null);',
    ];
    const stateAnchor = stateAnchors.find((line) => content.includes(line));
    if (stateAnchor) {
      content = ensureLineAfter(
        content,
        stateAnchor,
        '  const [rateLimitProbeResult, setRateLimitProbeResult] = useState<ProbeResult | null>(null);',
      );
    }
  }

  if (!content.includes('Check rate limit (click repeatedly)')) {
    const probePath = content.includes("runProbe(setHealthResult, '/health')")
      ? '/health/rate-limit'
      : '/api/health/rate-limit';
    const button = `        <button onClick={() => runProbe(setRateLimitProbeResult, '${probePath}')}>\n          Check rate limit (click repeatedly)\n        </button>`;

    const actionsStart = content.indexOf('<div className="actions">');
    if (actionsStart >= 0) {
      const actionsEnd = content.indexOf('\n      </div>', actionsStart);
      if (actionsEnd >= 0) {
        content = `${content.slice(0, actionsEnd)}\n${button}${content.slice(actionsEnd)}`;
      }
    }
  }

  if (!content.includes("{renderResult('Rate limit probe response', rateLimitProbeResult)}")) {
    const resultLine = "      {renderResult('Rate limit probe response', rateLimitProbeResult)}";
    const networkLine = '      {networkError ? <p className="error">{networkError}</p> : null}';
    if (content.includes(networkLine)) {
      content = content.replace(networkLine, `${resultLine}\n${networkLine}`);
    } else {
      const anchors = [
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
    'COPY packages/auth-api/package.json packages/auth-api/package.json',
    'COPY packages/logger/package.json packages/logger/package.json',
    'COPY packages/swagger/package.json packages/swagger/package.json',
    'COPY packages/i18n/package.json packages/i18n/package.json',
    'COPY packages/db-prisma/package.json packages/db-prisma/package.json',
    'COPY packages/core/package.json packages/core/package.json',
  ];
  const packageAnchor = packageAnchors.find((line) => content.includes(line)) ?? packageAnchors.at(-1);
  content = ensureLineAfter(
    content,
    packageAnchor,
    'COPY packages/rate-limit/package.json packages/rate-limit/package.json',
  );

  const sourceAnchors = [
    'COPY packages/auth-api packages/auth-api',
    'COPY packages/logger packages/logger',
    'COPY packages/swagger packages/swagger',
    'COPY packages/i18n packages/i18n',
    'COPY packages/db-prisma packages/db-prisma',
    'COPY packages/core packages/core',
  ];
  const sourceAnchor = sourceAnchors.find((line) => content.includes(line)) ?? sourceAnchors.at(-1);
  content = ensureLineAfter(content, sourceAnchor, 'COPY packages/rate-limit packages/rate-limit');

  content = content.replace(/^RUN pnpm --filter @forgeon\/rate-limit build\r?\n?/gm, '');
  const buildAnchor = content.includes('RUN pnpm --filter @forgeon/api prisma:generate')
    ? 'RUN pnpm --filter @forgeon/api prisma:generate'
    : 'RUN pnpm --filter @forgeon/api build';
  content = ensureLineBefore(content, buildAnchor, 'RUN pnpm --filter @forgeon/rate-limit build');

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchCompose(targetRoot) {
  const composePath = path.join(targetRoot, 'infra', 'docker', 'compose.yml');
  if (!fs.existsSync(composePath)) {
    return;
  }

  let content = fs.readFileSync(composePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes('THROTTLE_ENABLED: ${THROTTLE_ENABLED}')) {
    const anchors = [
      /^(\s+AUTH_DEMO_PASSWORD:.*)$/m,
      /^(\s+JWT_ACCESS_SECRET:.*)$/m,
      /^(\s+LOGGER_LEVEL:.*)$/m,
      /^(\s+SWAGGER_ENABLED:.*)$/m,
      /^(\s+I18N_DEFAULT_LANG:.*)$/m,
      /^(\s+DATABASE_URL:.*)$/m,
      /^(\s+API_PREFIX:.*)$/m,
    ];
    const anchorPattern = anchors.find((pattern) => pattern.test(content)) ?? anchors.at(-1);
    content = content.replace(
      anchorPattern,
      `$1
      THROTTLE_ENABLED: \${THROTTLE_ENABLED}
      THROTTLE_TTL: \${THROTTLE_TTL}
      THROTTLE_LIMIT: \${THROTTLE_LIMIT}
      THROTTLE_TRUST_PROXY: \${THROTTLE_TRUST_PROXY}`,
    );
  }

  fs.writeFileSync(composePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const marker = '## Rate Limit Module';
  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  if (content.includes(marker)) {
    return;
  }

  const section = `## Rate Limit Module

The rate-limit add-module installs independently and provides a simple first-line safeguard against burst traffic, accidental request loops, and brute-force style abuse.

What it adds:
- global request throttling for the API
- proxy-aware trust configuration for Caddy/Nginx setups
- a probe endpoint: \`GET /api/health/rate-limit\`
- a frontend probe button to verify the 429 response path

How to verify:
1. click "Check rate limit (click repeatedly)" several times within a few seconds
2. the first requests return \`200\`
3. the next request returns a \`429 TOO_MANY_REQUESTS\` envelope

Configuration (env):
- \`THROTTLE_ENABLED=true\`
- \`THROTTLE_TTL=10\` (seconds)
- \`THROTTLE_LIMIT=3\`
- \`THROTTLE_TRUST_PROXY=false\`

Operational notes:
- \`THROTTLE_TRUST_PROXY=true\` is recommended behind reverse proxies
- this is an in-memory throttle preset, not a distributed limiter
- no optional integration sync is required for this module in the current scaffold`;

  if (content.includes('## Prisma In Docker Start')) {
    content = content.replace('## Prisma In Docker Start', `${section}\n\n## Prisma In Docker Start`);
  } else {
    content = `${content.trimEnd()}\n\n${section}\n`;
  }

  fs.writeFileSync(readmePath, `${content.trimEnd()}\n`, 'utf8');
}

export function applyRateLimitModule({ packageRoot, targetRoot }) {
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'rate-limit'));
  patchApiPackage(targetRoot);
  patchAppModule(targetRoot);
  patchHealthController(targetRoot);
  patchWebApp(targetRoot);
  patchApiDockerfile(targetRoot);
  patchCompose(targetRoot);
  patchReadme(targetRoot);

  upsertEnvLines(path.join(targetRoot, 'apps', 'api', '.env.example'), [
    'THROTTLE_ENABLED=true',
    'THROTTLE_TTL=10',
    'THROTTLE_LIMIT=3',
    'THROTTLE_TRUST_PROXY=false',
  ]);
  upsertEnvLines(path.join(targetRoot, 'infra', 'docker', '.env.example'), [
    'THROTTLE_ENABLED=true',
    'THROTTLE_TTL=10',
    'THROTTLE_LIMIT=3',
    'THROTTLE_TRUST_PROXY=false',
  ]);
}
