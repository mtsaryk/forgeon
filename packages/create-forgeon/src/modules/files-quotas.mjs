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
  ensureNestCommonImport,
  ensureValidatorSchema,
  upsertEnvLines,
} from './shared/patch-utils.mjs';

function copyFromPreset(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'module-presets', 'files-quotas', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing files-quotas preset template: ${source}`);
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
  ensureDependency(packageJson, '@forgeon/files-quotas', 'workspace:*');
  ensureBuildSteps(packageJson, 'predev', ['pnpm --filter @forgeon/files-quotas build']);
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
    "import { filesQuotasConfig, filesQuotasEnvSchema, ForgeonFilesQuotasModule } from '@forgeon/files-quotas';",
  );
  content = ensureLoadItem(content, 'filesQuotasConfig');
  content = ensureValidatorSchema(content, 'filesQuotasEnvSchema');

  if (!content.includes('    ForgeonFilesQuotasModule,')) {
    if (content.includes('    ForgeonFilesAccessModule,')) {
      content = ensureLineAfter(content, '    ForgeonFilesAccessModule,', '    ForgeonFilesQuotasModule,');
    } else if (content.includes('    ForgeonFilesModule,')) {
      content = ensureLineAfter(content, '    ForgeonFilesModule,', '    ForgeonFilesQuotasModule,');
    } else if (content.includes('    ForgeonI18nModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonI18nModule.register({', '    ForgeonFilesQuotasModule,');
    } else if (content.includes('    ForgeonAuthModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonAuthModule.register({', '    ForgeonFilesQuotasModule,');
    } else if (content.includes('    ForgeonAuthModule.register(),')) {
      content = ensureLineBefore(content, '    ForgeonAuthModule.register(),', '    ForgeonFilesQuotasModule,');
    } else if (content.includes('    DbPrismaModule,')) {
      content = ensureLineAfter(content, '    DbPrismaModule,', '    ForgeonFilesQuotasModule,');
    } else if (content.includes('    ForgeonLoggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonLoggerModule,', '    ForgeonFilesQuotasModule,');
    } else if (content.includes('    ForgeonSwaggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonSwaggerModule,', '    ForgeonFilesQuotasModule,');
    } else {
      content = ensureLineAfter(content, '    CoreErrorsModule,', '    ForgeonFilesQuotasModule,');
    }
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchFilesController(targetRoot) {
  const filePath = path.join(targetRoot, 'packages', 'files', 'src', 'files.controller.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  content = ensureImportLine(content, "import { FilesQuotasService } from '@forgeon/files-quotas';");

  if (!content.includes('private readonly filesQuotasService: FilesQuotasService')) {
    const constructorMatch = content.match(/constructor\(([\s\S]*?)\)\s*\{/m);
    if (constructorMatch) {
      const original = constructorMatch[0];
      const inner = constructorMatch[1].trimEnd();
      const normalizedInner = inner.replace(/,\s*$/, '');
      const separator = normalizedInner.length > 0 ? ',' : '';
      const next = `constructor(${normalizedInner}${separator}
    private readonly filesQuotasService: FilesQuotasService,
  ) {`;
      content = content.replace(original, next);
    }
  }

  if (!content.includes('filesQuotasService.assertUploadAllowed')) {
    content = content.replace(
      '    return this.filesService.create({',
      `    await this.filesQuotasService.assertUploadAllowed({
      ownerType: body.ownerType ?? 'system',
      ownerId: body.ownerId ?? null,
      fileSize: file.size,
    });

    return this.filesService.create({`,
    );
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchHealthController(targetRoot) {
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  content = ensureNestCommonImport(content, 'Query');
  content = ensureImportLine(content, "import { FilesQuotasService } from '@forgeon/files-quotas';");

  if (!content.includes('private readonly filesQuotasService: FilesQuotasService')) {
    const constructorMatch = content.match(/constructor\(([\s\S]*?)\)\s*\{/m);
    if (constructorMatch) {
      const original = constructorMatch[0];
      const inner = constructorMatch[1].trimEnd();
      const normalizedInner = inner.replace(/,\s*$/, '');
      const separator = normalizedInner.length > 0 ? ',' : '';
      const next = `constructor(${normalizedInner}${separator}
    private readonly filesQuotasService: FilesQuotasService,
  ) {`;
      content = content.replace(original, next);
    }
  }

  if (!content.includes("@Get('files-quotas')")) {
    const method = `
  @Get('files-quotas')
  async getFilesQuotasProbe(
    @Query('ownerType') ownerType = 'user',
    @Query('ownerId') ownerId = 'probe-owner',
    @Query('size') size = '1024',
  ) {
    const parsedSize = Number.isFinite(Number(size)) ? Math.max(1, Number(size)) : 1024;
    return this.filesQuotasService.getProbeStatus({
      ownerType,
      ownerId: ownerId || null,
      fileSize: parsedSize,
    });
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

  if (!content.includes('filesQuotasProbeResult')) {
    const stateAnchors = [
      '  const [filesAccessProbeResult, setFilesAccessProbeResult] = useState<ProbeResult | null>(null);',
      '  const [filesProbeResult, setFilesProbeResult] = useState<ProbeResult | null>(null);',
      '  const [rbacProbeResult, setRbacProbeResult] = useState<ProbeResult | null>(null);',
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
        '  const [filesQuotasProbeResult, setFilesQuotasProbeResult] = useState<ProbeResult | null>(null);',
      );
    }
  }

  if (!content.includes('Check files quotas')) {
    const probePath = content.includes("runProbe(setHealthResult, '/health')")
      ? '/health/files-quotas'
      : '/api/health/files-quotas';
    const button = `        <button onClick={() => runProbe(setFilesQuotasProbeResult, '${probePath}')}>
          Check files quotas
        </button>`;

    const actionsStart = content.indexOf('<div className="actions">');
    if (actionsStart >= 0) {
      const actionsEnd = content.indexOf('\n      </div>', actionsStart);
      if (actionsEnd >= 0) {
        content = `${content.slice(0, actionsEnd)}\n${button}${content.slice(actionsEnd)}`;
      }
    }
  }

  if (!content.includes("{renderResult('Files quotas probe response', filesQuotasProbeResult)}")) {
    const resultLine = "      {renderResult('Files quotas probe response', filesQuotasProbeResult)}";
    const networkLine = '      {networkError ? <p className="error">{networkError}</p> : null}';
    if (content.includes(networkLine)) {
      content = content.replace(networkLine, `${resultLine}\n${networkLine}`);
    } else {
      const anchors = [
        "      {renderResult('Files access probe response', filesAccessProbeResult)}",
        "      {renderResult('Files probe response', filesProbeResult)}",
        "      {renderResult('RBAC probe response', rbacProbeResult)}",
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
    'COPY packages/files-access/package.json packages/files-access/package.json',
    'COPY packages/files/package.json packages/files/package.json',
    'COPY packages/files-local/package.json packages/files-local/package.json',
    'COPY packages/files-s3/package.json packages/files-s3/package.json',
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
  content = ensureLineAfter(
    content,
    packageAnchor,
    'COPY packages/files-quotas/package.json packages/files-quotas/package.json',
  );

  const sourceAnchors = [
    'COPY packages/files-access packages/files-access',
    'COPY packages/files packages/files',
    'COPY packages/files-local packages/files-local',
    'COPY packages/files-s3 packages/files-s3',
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
  content = ensureLineAfter(content, sourceAnchor, 'COPY packages/files-quotas packages/files-quotas');

  content = content.replace(/^RUN pnpm --filter @forgeon\/files-quotas build\r?\n?/gm, '');
  const buildAnchor = content.includes('RUN pnpm --filter @forgeon/api prisma:generate')
    ? 'RUN pnpm --filter @forgeon/api prisma:generate'
    : 'RUN pnpm --filter @forgeon/api build';
  content = ensureLineBefore(content, buildAnchor, 'RUN pnpm --filter @forgeon/files-quotas build');

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchCompose(targetRoot) {
  const composePath = path.join(targetRoot, 'infra', 'docker', 'compose.yml');
  if (!fs.existsSync(composePath)) {
    return;
  }

  let content = fs.readFileSync(composePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes('FILES_QUOTAS_ENABLED: ${FILES_QUOTAS_ENABLED}')) {
    const anchors = [
      /^(\s+FILES_ALLOWED_MIME_PREFIXES:.*)$/m,
      /^(\s+FILES_MAX_FILE_SIZE_BYTES:.*)$/m,
      /^(\s+FILES_PUBLIC_BASE_PATH:.*)$/m,
      /^(\s+FILES_STORAGE_DRIVER:.*)$/m,
      /^(\s+FILES_ENABLED:.*)$/m,
      /^(\s+API_PREFIX:.*)$/m,
    ];
    const anchorPattern = anchors.find((pattern) => pattern.test(content)) ?? anchors.at(-1);
    content = content.replace(
      anchorPattern,
      `$1
      FILES_QUOTAS_ENABLED: \${FILES_QUOTAS_ENABLED}
      FILES_QUOTA_MAX_FILES_PER_OWNER: \${FILES_QUOTA_MAX_FILES_PER_OWNER}
      FILES_QUOTA_MAX_BYTES_PER_OWNER: \${FILES_QUOTA_MAX_BYTES_PER_OWNER}`,
    );
  }

  fs.writeFileSync(composePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const marker = '## Files Quotas Module';
  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  if (content.includes(marker)) {
    return;
  }

  const section = `## Files Quotas Module

The files-quotas module adds owner-based limits for file upload attempts.

What it adds:
- \`@forgeon/files-quotas\` package
- upload pre-check in files controller
- probe endpoint: \`GET /api/health/files-quotas\`

Current quota model:
- max files per owner
- max total bytes per owner
- owner identity from file payload (\`ownerType\`, \`ownerId\`)

Key env:
- \`FILES_QUOTAS_ENABLED=true\`
- \`FILES_QUOTA_MAX_FILES_PER_OWNER=100\`
- \`FILES_QUOTA_MAX_BYTES_PER_OWNER=104857600\``;

  if (content.includes('## Prisma In Docker Start')) {
    content = content.replace('## Prisma In Docker Start', `${section}\n\n## Prisma In Docker Start`);
  } else {
    content = `${content.trimEnd()}\n\n${section}\n`;
  }

  fs.writeFileSync(readmePath, `${content.trimEnd()}\n`, 'utf8');
}

export function applyFilesQuotasModule({ packageRoot, targetRoot }) {
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'files-quotas'));
  patchApiPackage(targetRoot);
  patchAppModule(targetRoot);
  patchFilesController(targetRoot);
  patchHealthController(targetRoot);
  patchWebApp(targetRoot);
  patchApiDockerfile(targetRoot);
  patchCompose(targetRoot);
  patchReadme(targetRoot);

  upsertEnvLines(path.join(targetRoot, 'apps', 'api', '.env.example'), [
    'FILES_QUOTAS_ENABLED=true',
    'FILES_QUOTA_MAX_FILES_PER_OWNER=100',
    'FILES_QUOTA_MAX_BYTES_PER_OWNER=104857600',
  ]);
  upsertEnvLines(path.join(targetRoot, 'infra', 'docker', '.env.example'), [
    'FILES_QUOTAS_ENABLED=true',
    'FILES_QUOTA_MAX_FILES_PER_OWNER=100',
    'FILES_QUOTA_MAX_BYTES_PER_OWNER=104857600',
  ]);
}
