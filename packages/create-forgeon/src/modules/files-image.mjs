import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive, writeJson } from '../utils/fs.mjs';
import {
  ensureBuildStepBefore,
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
  const source = path.join(packageRoot, 'templates', 'module-presets', 'files-image', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing files-image preset template: ${source}`);
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
  ensureDependency(packageJson, '@forgeon/files-image', 'workspace:*');
  ensureBuildSteps(packageJson, 'predev', ['pnpm --filter @forgeon/files-image build']);
  ensureBuildStepBefore(
    packageJson,
    'predev',
    'pnpm --filter @forgeon/files-image build',
    'pnpm --filter @forgeon/files build',
  );
  writeJson(packagePath, packageJson);
}

function patchFilesPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'packages', 'files', 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  ensureDependency(packageJson, '@forgeon/files-image', 'workspace:*');
  writeJson(packagePath, packageJson);
}

function patchRootPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (!packageJson.pnpm || typeof packageJson.pnpm !== 'object' || Array.isArray(packageJson.pnpm)) {
    packageJson.pnpm = {};
  }

  const onlyBuiltDependencies = Array.isArray(packageJson.pnpm.onlyBuiltDependencies)
    ? packageJson.pnpm.onlyBuiltDependencies
    : [];

  if (!onlyBuiltDependencies.includes('sharp')) {
    onlyBuiltDependencies.push('sharp');
  }

  packageJson.pnpm.onlyBuiltDependencies = onlyBuiltDependencies;
  writeJson(packagePath, packageJson);
}

function patchFilesTypes(targetRoot) {
  const filePath = path.join(targetRoot, 'packages', 'files', 'src', 'files.types.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes('auditContext?:')) {
    content = content.replace(
      /(\s+createdById\?: string;\n)(\};)/m,
      `$1  auditContext?: {
    requestId?: string | null;
    ip?: string | null;
    userId?: string | null;
  };
$2`,
    );
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchAppModule(targetRoot) {
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  content = ensureImportLine(
    content,
    "import { filesImageConfig, filesImageEnvSchema, ForgeonFilesImageModule } from '@forgeon/files-image';",
  );
  content = ensureLoadItem(content, 'filesImageConfig');
  content = ensureValidatorSchema(content, 'filesImageEnvSchema');

  if (!content.includes('    ForgeonFilesImageModule,')) {
    if (content.includes('    ForgeonI18nModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonI18nModule.register({', '    ForgeonFilesImageModule,');
    } else if (content.includes('    ForgeonAuthModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonAuthModule.register({', '    ForgeonFilesImageModule,');
    } else if (content.includes('    ForgeonAuthModule.register(),')) {
      content = ensureLineBefore(content, '    ForgeonAuthModule.register(),', '    ForgeonFilesImageModule,');
    } else if (content.includes('    ForgeonFilesModule,')) {
      content = ensureLineAfter(content, '    ForgeonFilesModule,', '    ForgeonFilesImageModule,');
    } else if (content.includes('    DbPrismaModule,')) {
      content = ensureLineAfter(content, '    DbPrismaModule,', '    ForgeonFilesImageModule,');
    } else if (content.includes('    ForgeonLoggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonLoggerModule,', '    ForgeonFilesImageModule,');
    } else if (content.includes('    ForgeonSwaggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonSwaggerModule,', '    ForgeonFilesImageModule,');
    } else {
      content = ensureLineAfter(content, '    CoreErrorsModule,', '    ForgeonFilesImageModule,');
    }
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchFilesModule(targetRoot) {
  const filePath = path.join(targetRoot, 'packages', 'files', 'src', 'forgeon-files.module.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  content = ensureImportLine(content, "import { ForgeonFilesImageModule } from '@forgeon/files-image';");
  if (!content.includes('ForgeonFilesImageModule')) {
    content = content.replace('imports: [FilesConfigModule],', 'imports: [FilesConfigModule, ForgeonFilesImageModule],');
  } else {
    content = content.replace(
      'imports: [FilesConfigModule],',
      'imports: [FilesConfigModule, ForgeonFilesImageModule],',
    );
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchFilesController(targetRoot) {
  const filePath = path.join(targetRoot, 'packages', 'files', 'src', 'files.controller.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  content = ensureNestCommonImport(content, 'Req');

  if (!content.includes('auditContext: {')) {
    content = content.replace(
      `  async uploadFile(
    @UploadedFile() file: UploadedFileShape | undefined,
    @Body() body: CreateFileDto,
  ) {`,
      `  async uploadFile(
    @UploadedFile() file: UploadedFileShape | undefined,
    @Body() body: CreateFileDto,
    @Req() req: any,
  ) {`,
    );

    content = content.replace(
      `      createdById: body.createdById,
    });`,
      `      createdById: body.createdById,
      auditContext: {
        requestId:
          typeof req?.headers?.['x-request-id'] === 'string' ? req.headers['x-request-id'] : null,
        ip: typeof req?.ip === 'string' ? req.ip : null,
        userId: typeof body.createdById === 'string' && body.createdById.length > 0 ? body.createdById : null,
      },
    });`,
    );
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchFilesService(targetRoot) {
  const filePath = path.join(targetRoot, 'packages', 'files', 'src', 'files.service.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  content = ensureImportLine(content, "import { FilesImageService } from '@forgeon/files-image';");

  if (!content.includes('private readonly filesImageService: FilesImageService')) {
    const constructorMatch = content.match(/constructor\(([\s\S]*?)\)\s*\{/m);
    if (constructorMatch) {
      const original = constructorMatch[0];
      const inner = constructorMatch[1].trimEnd();
      const normalizedInner = inner.replace(/,\s*$/, '');
      const separator = normalizedInner.length > 0 ? ',' : '';
      const next = `constructor(${normalizedInner}${separator}
    private readonly filesImageService: FilesImageService,
  ) {`;
      content = content.replace(original, next);
    }
  }

  if (!content.includes('filesImageService.sanitizeForStorage')) {
    content = content.replace(
      `  protected async prepareOriginalForStorage(input: StoredFileInput): Promise<PreparedStoredFile> {
    return {
      buffer: input.buffer,
      mimeType: input.mimeType,
      size: input.size,
      fileName: input.originalName,
    };
  }`,
      `  protected async prepareOriginalForStorage(input: StoredFileInput): Promise<PreparedStoredFile> {
    const sanitized = await this.filesImageService.sanitizeForStorage({
      buffer: input.buffer,
      declaredMimeType: input.mimeType,
      originalName: input.originalName,
      auditContext: input.auditContext,
    });
    return {
      buffer: sanitized.buffer,
      mimeType: sanitized.mimeType,
      size: sanitized.buffer.byteLength,
      fileName: this.normalizeFileName(input.originalName, sanitized.extension),
    };
  }`,
    );

    content = content.replace(
      `  protected async buildPreviewVariant(
    _preparedOriginal: PreparedStoredFile,
    _input: StoredFileInput,
  ): Promise<PreparedStoredFile | null> {
    return null;
  }`,
      `  protected async buildPreviewVariant(
    preparedOriginal: PreparedStoredFile,
    input: StoredFileInput,
  ): Promise<PreparedStoredFile | null> {
    const preview = await this.filesImageService.buildPreviewVariant({
      buffer: preparedOriginal.buffer,
      declaredMimeType: preparedOriginal.mimeType,
      originalName: input.originalName,
      auditContext: input.auditContext,
    });
    if (!preview) {
      return null;
    }

    return {
      buffer: preview.buffer,
      mimeType: preview.mimeType,
      size: preview.buffer.byteLength,
      fileName: this.normalizeFileName(input.originalName, preview.extension, 'preview'),
    };
  }`,
    );

    content = content.replace(
      `  protected async isPreviewGenerationEnabled(): Promise<boolean> {
    return false;
  }`,
      `  protected async isPreviewGenerationEnabled(): Promise<boolean> {
    return this.filesImageService.isPreviewEnabled();
  }`,
    );

    content = content.replace(
      `  private extensionFromMime(mimeType: string): string | null {`,
      `  protected normalizeFileName(originalName: string, extension: string, suffix?: string): string {
    const parsed = path.parse(originalName);
    const safeExtension = extension.startsWith('.') ? extension : \`.\${extension}\`;
    const base = suffix ? \`\${parsed.name}-\${suffix}\` : parsed.name;
    return \`\${base}\${safeExtension}\`;
  }

  private extensionFromMime(mimeType: string): string | null {`,
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
  content = ensureImportLine(content, "import { FilesImageService } from '@forgeon/files-image';");
  content = ensureNestCommonImport(content, 'Get');

  if (!content.includes('private readonly filesImageService: FilesImageService')) {
    const constructorMatch = content.match(/constructor\(([\s\S]*?)\)\s*\{/m);
    if (constructorMatch) {
      const original = constructorMatch[0];
      const inner = constructorMatch[1].trimEnd();
      const normalizedInner = inner.replace(/,\s*$/, '');
      const separator = normalizedInner.length > 0 ? ',' : '';
      const next = `constructor(${normalizedInner}${separator}
    private readonly filesImageService: FilesImageService,
  ) {`;
      content = content.replace(original, next);
    }
  }

  if (!content.includes("@Get('files-image')")) {
    const method = `
  @Get('files-image')
  async getFilesImageProbe() {
    return this.filesImageService.getProbeStatus();
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

  if (!content.includes('filesImageProbeResult')) {
    const stateAnchors = [
      '  const [filesQuotasProbeResult, setFilesQuotasProbeResult] = useState<ProbeResult | null>(null);',
      '  const [filesAccessProbeResult, setFilesAccessProbeResult] = useState<ProbeResult | null>(null);',
      '  const [filesProbeResult, setFilesProbeResult] = useState<ProbeResult | null>(null);',
      '  const [validationProbeResult, setValidationProbeResult] = useState<ProbeResult | null>(null);',
    ];
    const stateAnchor = stateAnchors.find((line) => content.includes(line));
    if (stateAnchor) {
      content = ensureLineAfter(
        content,
        stateAnchor,
        '  const [filesImageProbeResult, setFilesImageProbeResult] = useState<ProbeResult | null>(null);',
      );
    }
  }

  if (!content.includes('Check files image sanitize')) {
    const probePath = content.includes("runProbe(setHealthResult, '/health')")
      ? '/health/files-image'
      : '/api/health/files-image';
    const button = `        <button onClick={() => runProbe(setFilesImageProbeResult, '${probePath}')}>
          Check files image sanitize
        </button>`;

    const actionsStart = content.indexOf('<div className="actions">');
    if (actionsStart >= 0) {
      const actionsEnd = content.indexOf('\n      </div>', actionsStart);
      if (actionsEnd >= 0) {
        content = `${content.slice(0, actionsEnd)}\n${button}${content.slice(actionsEnd)}`;
      }
    }
  }

  if (!content.includes("{renderResult('Files image probe response', filesImageProbeResult)}")) {
    const resultLine = "      {renderResult('Files image probe response', filesImageProbeResult)}";
    const networkLine = '      {networkError ? <p className="error">{networkError}</p> : null}';
    if (content.includes(networkLine)) {
      content = content.replace(networkLine, `${resultLine}\n${networkLine}`);
    } else {
      const anchors = [
        "      {renderResult('Files quotas probe response', filesQuotasProbeResult)}",
        "      {renderResult('Files access probe response', filesAccessProbeResult)}",
        "      {renderResult('Files probe response', filesProbeResult)}",
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
    'COPY packages/files-quotas/package.json packages/files-quotas/package.json',
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
    'COPY packages/files-image/package.json packages/files-image/package.json',
  );

  const sourceAnchors = [
    'COPY packages/files-quotas packages/files-quotas',
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
  content = ensureLineAfter(content, sourceAnchor, 'COPY packages/files-image packages/files-image');

  content = content.replace(/^RUN pnpm --filter @forgeon\/files-image build\r?\n?/gm, '');
  const buildAnchor = content.includes('RUN pnpm --filter @forgeon/files build')
    ? 'RUN pnpm --filter @forgeon/files build'
    : content.includes('RUN pnpm --filter @forgeon/api prisma:generate')
      ? 'RUN pnpm --filter @forgeon/api prisma:generate'
      : 'RUN pnpm --filter @forgeon/api build';
  content = ensureLineBefore(content, buildAnchor, 'RUN pnpm --filter @forgeon/files-image build');

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchCompose(targetRoot) {
  const composePath = path.join(targetRoot, 'infra', 'docker', 'compose.yml');
  if (!fs.existsSync(composePath)) {
    return;
  }

  let content = fs.readFileSync(composePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes('FILES_IMAGE_ENABLED: ${FILES_IMAGE_ENABLED}')) {
    const anchors = [
      /^(\s+FILES_QUOTA_MAX_BYTES_PER_OWNER:.*)$/m,
      /^(\s+FILES_QUOTAS_ENABLED:.*)$/m,
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
      FILES_IMAGE_ENABLED: \${FILES_IMAGE_ENABLED}
      FILES_IMAGE_STRIP_METADATA: \${FILES_IMAGE_STRIP_METADATA}
      FILES_IMAGE_MAX_WIDTH: \${FILES_IMAGE_MAX_WIDTH}
      FILES_IMAGE_MAX_HEIGHT: \${FILES_IMAGE_MAX_HEIGHT}
      FILES_IMAGE_MAX_PIXELS: \${FILES_IMAGE_MAX_PIXELS}
      FILES_IMAGE_MAX_FRAMES: \${FILES_IMAGE_MAX_FRAMES}
      FILES_IMAGE_PROCESS_TIMEOUT_MS: \${FILES_IMAGE_PROCESS_TIMEOUT_MS}
      FILES_IMAGE_ALLOWED_MIME_TYPES: \${FILES_IMAGE_ALLOWED_MIME_TYPES}`,
    );
  }

  fs.writeFileSync(composePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const marker = '## Files Image Module';
  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  if (content.includes(marker)) {
    return;
  }

  const section = `## Files Image Module

The files-image module adds image content validation by magic bytes and sanitize/re-encode before storage.

What it adds:
- \`@forgeon/files-image\` package (\`sharp + file-type\`)
- image pipeline in files runtime:
  - detect actual type by magic bytes
  - reject declared/detected mismatches
  - decode -> sanitize -> re-encode
  - generate optional \`preview\` file variant for image uploads
- probe endpoint: \`GET /api/health/files-image\`

Default security behavior:
- metadata is stripped before storage (\`FILES_IMAGE_STRIP_METADATA=true\`)

Key env:
- \`FILES_IMAGE_ENABLED=true\`
- \`FILES_IMAGE_STRIP_METADATA=true\`
- \`FILES_IMAGE_MAX_WIDTH=4096\`
- \`FILES_IMAGE_MAX_HEIGHT=4096\`
- \`FILES_IMAGE_MAX_PIXELS=16777216\`
- \`FILES_IMAGE_MAX_FRAMES=1\`
- \`FILES_IMAGE_PROCESS_TIMEOUT_MS=5000\`
- \`FILES_IMAGE_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp\``;

  if (content.includes('## Prisma In Docker Start')) {
    content = content.replace('## Prisma In Docker Start', `${section}\n\n## Prisma In Docker Start`);
  } else {
    content = `${content.trimEnd()}\n\n${section}\n`;
  }

  fs.writeFileSync(readmePath, `${content.trimEnd()}\n`, 'utf8');
}

export function applyFilesImageModule({ packageRoot, targetRoot }) {
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'files-image'));
  patchApiPackage(targetRoot);
  patchFilesPackage(targetRoot);
  patchRootPackage(targetRoot);
  patchFilesTypes(targetRoot);
  patchAppModule(targetRoot);
  patchFilesModule(targetRoot);
  patchFilesController(targetRoot);
  patchFilesService(targetRoot);
  patchHealthController(targetRoot);
  patchWebApp(targetRoot);
  patchApiDockerfile(targetRoot);
  patchCompose(targetRoot);
  patchReadme(targetRoot);

  upsertEnvLines(path.join(targetRoot, 'apps', 'api', '.env.example'), [
    'FILES_IMAGE_ENABLED=true',
    'FILES_IMAGE_STRIP_METADATA=true',
    'FILES_IMAGE_MAX_WIDTH=4096',
    'FILES_IMAGE_MAX_HEIGHT=4096',
    'FILES_IMAGE_MAX_PIXELS=16777216',
    'FILES_IMAGE_MAX_FRAMES=1',
    'FILES_IMAGE_PROCESS_TIMEOUT_MS=5000',
    'FILES_IMAGE_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp',
  ]);
  upsertEnvLines(path.join(targetRoot, 'infra', 'docker', '.env.example'), [
    'FILES_IMAGE_ENABLED=true',
    'FILES_IMAGE_STRIP_METADATA=true',
    'FILES_IMAGE_MAX_WIDTH=4096',
    'FILES_IMAGE_MAX_HEIGHT=4096',
    'FILES_IMAGE_MAX_PIXELS=16777216',
    'FILES_IMAGE_MAX_FRAMES=1',
    'FILES_IMAGE_PROCESS_TIMEOUT_MS=5000',
    'FILES_IMAGE_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp',
  ]);
}
