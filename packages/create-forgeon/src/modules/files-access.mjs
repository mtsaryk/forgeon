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
  const source = path.join(packageRoot, 'templates', 'module-presets', 'files-access', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing files-access preset template: ${source}`);
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
  ensureDependency(packageJson, '@forgeon/files-access', 'workspace:*');
  ensureBuildSteps(packageJson, 'predev', ['pnpm --filter @forgeon/files-access build']);
  writeJson(packagePath, packageJson);
}

function patchFilesPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'packages', 'files', 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  ensureDependency(packageJson, '@forgeon/files-access', 'workspace:*');
  writeJson(packagePath, packageJson);
}

function patchAppModule(targetRoot) {
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  content = ensureImportLine(content, "import { ForgeonFilesAccessModule } from '@forgeon/files-access';");

  if (!content.includes('    ForgeonFilesAccessModule,')) {
    if (content.includes('    ForgeonFilesModule,')) {
      content = ensureLineAfter(content, '    ForgeonFilesModule,', '    ForgeonFilesAccessModule,');
    } else if (content.includes('    ForgeonI18nModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonI18nModule.register({', '    ForgeonFilesAccessModule,');
    } else if (content.includes('    ForgeonAuthModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonAuthModule.register({', '    ForgeonFilesAccessModule,');
    } else if (content.includes('    ForgeonAuthModule.register(),')) {
      content = ensureLineBefore(content, '    ForgeonAuthModule.register(),', '    ForgeonFilesAccessModule,');
    } else if (content.includes('    DbPrismaModule,')) {
      content = ensureLineAfter(content, '    DbPrismaModule,', '    ForgeonFilesAccessModule,');
    } else if (content.includes('    ForgeonLoggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonLoggerModule,', '    ForgeonFilesAccessModule,');
    } else if (content.includes('    ForgeonSwaggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonSwaggerModule,', '    ForgeonFilesAccessModule,');
    } else {
      content = ensureLineAfter(content, '    CoreErrorsModule,', '    ForgeonFilesAccessModule,');
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
  content = ensureNestCommonImport(content, 'Req');
  content = ensureImportLine(
    content,
    "import { extractFilesAccessSubject, FilesAccessService } from '@forgeon/files-access';",
  );

  if (!content.includes('private readonly filesAccessService: FilesAccessService')) {
    const constructorMatch = content.match(/constructor\(([\s\S]*?)\)\s*\{/m);
    if (constructorMatch) {
      const original = constructorMatch[0];
      const inner = constructorMatch[1].trimEnd();
      const normalizedInner = inner.replace(/,\s*$/, '');
      const separator = normalizedInner.length > 0 ? ',' : '';
      const next = `constructor(${normalizedInner}${separator}
    private readonly filesAccessService: FilesAccessService,
  ) {`;
      content = content.replace(original, next);
    } else {
      const classAnchor = 'export class FilesController {';
      if (content.includes(classAnchor)) {
        content = content.replace(
          classAnchor,
          `${classAnchor}
  constructor(
    private readonly filesService: FilesService,
    private readonly filesAccessService: FilesAccessService,
  ) {}
`,
        );
      }
    }
  }

  if (!content.includes('filesAccessService.assertCanRead')) {
    content = content.replace(
      `  async getMetadata(@Param('publicId') publicId: string) {
    return this.filesService.getByPublicId(publicId);
  }`,
      `  async getMetadata(@Param('publicId') publicId: string, @Req() req: any) {
    const file = await this.filesService.getByPublicId(publicId);
    this.filesAccessService.assertCanRead(file, extractFilesAccessSubject(req));
    return file;
  }`,
    );

    content = content.replace(
      `  async download(@Param('publicId') publicId: string, @Query('variant') variantQuery?: string) {
    const variant = this.parseVariant(variantQuery);
    const payload = await this.filesService.openDownload(publicId, variant);
    return new StreamableFile(payload.stream, {
      disposition: \`inline; filename="\${payload.fileName}"\`,
      type: payload.mimeType,
    });
  }`,
      `  async download(
    @Param('publicId') publicId: string,
    @Query('variant') variantQuery?: string,
    @Req() req: any,
  ) {
    const variant = this.parseVariant(variantQuery);
    const file = await this.filesService.getByPublicId(publicId);
    this.filesAccessService.assertCanRead(file, extractFilesAccessSubject(req));
    const payload = await this.filesService.openDownload(publicId, variant);
    return new StreamableFile(payload.stream, {
      disposition: \`inline; filename="\${payload.fileName}"\`,
      type: payload.mimeType,
    });
  }`,
    );

    content = content.replace(
      `  async download(@Param('publicId') publicId: string) {
    const payload = await this.filesService.openDownload(publicId);
    return new StreamableFile(payload.stream, {
      disposition: \`inline; filename="\${payload.fileName}"\`,
      type: payload.mimeType,
    });
  }`,
      `  async download(@Param('publicId') publicId: string, @Req() req: any) {
    const file = await this.filesService.getByPublicId(publicId);
    this.filesAccessService.assertCanRead(file, extractFilesAccessSubject(req));
    const payload = await this.filesService.openDownload(publicId);
    return new StreamableFile(payload.stream, {
      disposition: \`inline; filename="\${payload.fileName}"\`,
      type: payload.mimeType,
    });
  }`,
    );

    content = content.replace(
      `  async remove(@Param('publicId') publicId: string) {
    return this.filesService.deleteByPublicId(publicId);
  }`,
      `  async remove(@Param('publicId') publicId: string, @Req() req: any) {
    const file = await this.filesService.getByPublicId(publicId);
    this.filesAccessService.assertCanDelete(file, extractFilesAccessSubject(req));
    return this.filesService.deleteByPublicId(publicId);
  }`,
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
  content = ensureNestCommonImport(content, 'Req');
  content = ensureImportLine(
    content,
    "import { extractFilesAccessSubject, FilesAccessService } from '@forgeon/files-access';",
  );

  if (!content.includes('private readonly filesAccessService: FilesAccessService')) {
    const constructorMatch = content.match(/constructor\(([\s\S]*?)\)\s*\{/m);
    if (constructorMatch) {
      const original = constructorMatch[0];
      const inner = constructorMatch[1].trimEnd();
      const normalizedInner = inner.replace(/,\s*$/, '');
      const separator = normalizedInner.length > 0 ? ',' : '';
      const next = `constructor(${normalizedInner}${separator}
    private readonly filesAccessService: FilesAccessService,
  ) {`;
      content = content.replace(original, next);
    } else {
      const classAnchor = 'export class HealthController {';
      if (content.includes(classAnchor)) {
        content = content.replace(
          classAnchor,
          `${classAnchor}
  constructor(private readonly filesAccessService: FilesAccessService) {}
`,
        );
      }
    }
  }

  if (!content.includes("@Get('files-access')")) {
    const method = `
  @Get('files-access')
  getFilesAccessProbe(@Req() req: any) {
    const subject = extractFilesAccessSubject(req);
    const sample = {
      ownerType: 'user',
      ownerId: 'probe-owner',
      visibility: 'private',
    };

    return {
      status: 'ok',
      feature: 'files-access',
      canRead: this.filesAccessService.canRead(sample, subject),
      canDelete: this.filesAccessService.canDelete(sample, subject),
      hint: 'Send x-forgeon-user-id: probe-owner or x-forgeon-permissions: files.manage',
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

  if (!content.includes('filesAccessProbeResult')) {
    const stateAnchors = [
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
        '  const [filesAccessProbeResult, setFilesAccessProbeResult] = useState<ProbeResult | null>(null);',
      );
    }
  }

  if (!content.includes('Check files access')) {
    const probePath = content.includes("runProbe(setHealthResult, '/health')")
      ? '/health/files-access'
      : '/api/health/files-access';
    const button = `        <button
          onClick={() =>
            runProbe(setFilesAccessProbeResult, '${probePath}', {
              headers: { 'x-forgeon-user-id': 'probe-owner' },
            })
          }
        >
          Check files access
        </button>`;

    const actionsStart = content.indexOf('<div className="actions">');
    if (actionsStart >= 0) {
      const actionsEnd = content.indexOf('\n      </div>', actionsStart);
      if (actionsEnd >= 0) {
        content = `${content.slice(0, actionsEnd)}\n${button}${content.slice(actionsEnd)}`;
      }
    }
  }

  if (!content.includes("{renderResult('Files access probe response', filesAccessProbeResult)}")) {
    const resultLine = "      {renderResult('Files access probe response', filesAccessProbeResult)}";
    const networkLine = '      {networkError ? <p className="error">{networkError}</p> : null}';
    if (content.includes(networkLine)) {
      content = content.replace(networkLine, `${resultLine}\n${networkLine}`);
    } else {
      const anchors = [
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
    'COPY packages/files-access/package.json packages/files-access/package.json',
  );

  const sourceAnchors = [
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
  content = ensureLineAfter(content, sourceAnchor, 'COPY packages/files-access packages/files-access');

  content = content.replace(/^RUN pnpm --filter @forgeon\/files-access build\r?\n?/gm, '');
  const buildAnchor = content.includes('RUN pnpm --filter @forgeon/api prisma:generate')
    ? 'RUN pnpm --filter @forgeon/api prisma:generate'
    : 'RUN pnpm --filter @forgeon/api build';
  content = ensureLineBefore(content, buildAnchor, 'RUN pnpm --filter @forgeon/files-access build');

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const marker = '## Files Access Module';
  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  if (content.includes(marker)) {
    return;
  }

  const section = `## Files Access Module

The files-access module adds resource-level authorization checks for file metadata, download, and delete operations.

What it adds:
- \`@forgeon/files-access\` package
- policy service with owner/public/permission checks
- files controller enforcement for:
  - \`GET /api/files/:publicId\`
  - \`GET /api/files/:publicId/download\`
  - \`DELETE /api/files/:publicId\`
- probe endpoint: \`GET /api/health/files-access\`

Current policy rules:
- allow if permission \`files.manage\` is present
- allow owner (when \`ownerType=user\` and \`ownerId\` matches actor)
- allow read for \`visibility=public\`

Actor context for probe/testing:
- \`x-forgeon-user-id\`
- \`x-forgeon-permissions\` (comma-separated)`;

  if (content.includes('## Prisma In Docker Start')) {
    content = content.replace('## Prisma In Docker Start', `${section}\n\n## Prisma In Docker Start`);
  } else {
    content = `${content.trimEnd()}\n\n${section}\n`;
  }

  fs.writeFileSync(readmePath, `${content.trimEnd()}\n`, 'utf8');
}

export function applyFilesAccessModule({ packageRoot, targetRoot }) {
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'files-access'));
  patchApiPackage(targetRoot);
  patchFilesPackage(targetRoot);
  patchAppModule(targetRoot);
  patchFilesController(targetRoot);
  patchHealthController(targetRoot);
  patchWebApp(targetRoot);
  patchApiDockerfile(targetRoot);
  patchReadme(targetRoot);
}
