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
  const source = path.join(packageRoot, 'templates', 'module-presets', 'files', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing files preset template: ${source}`);
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
  ensureDependency(packageJson, '@forgeon/files', 'workspace:*');
  ensureBuildSteps(packageJson, 'predev', ['pnpm --filter @forgeon/files build']);
  writeJson(packagePath, packageJson);
}

function patchPrismaSchema(targetRoot) {
  const schemaPath = path.join(targetRoot, 'apps', 'api', 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    return;
  }

  let content = fs.readFileSync(schemaPath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes('model FileRecord {')) {
    const model = `
model FileRecord {
  id           String   @id @default(cuid())
  publicId     String   @unique
  storageKey   String
  originalName String
  mimeType     String
  size         Int
  storageDriver String
  ownerType    String   @default("system")
  ownerId      String?
  visibility   String   @default("private")
  createdById  String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  variants     FileVariant[]

  @@index([ownerType, ownerId, createdAt])
  @@index([createdById, createdAt])
  @@index([visibility, createdAt])
}
`;
    content = `${content.trimEnd()}\n\n${model.trim()}\n`;
  }

  content = content.replace(/storageKey\s+String\s+@unique/g, 'storageKey   String');

  if (!content.includes('variants     FileVariant[]')) {
    content = content.replace(
      /(model FileRecord \{[\s\S]*?updatedAt\s+DateTime @updatedAt)([\s\S]*?\n\})/m,
      '$1\n  variants     FileVariant[]$2',
    );
  }

  if (!content.includes('model FileVariant {')) {
    const model = `
model FileVariant {
  id           String   @id @default(cuid())
  fileId       String
  variantKey   String
  blobId       String
  mimeType     String
  size         Int
  status       String   @default("ready")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  file         FileRecord @relation(fields: [fileId], references: [id], onDelete: Cascade)
  blob         FileBlob   @relation(fields: [blobId], references: [id], onDelete: Restrict)

  @@unique([fileId, variantKey])
  @@index([blobId])
  @@index([variantKey, status])
}
`;
    content = `${content.trimEnd()}\n\n${model.trim()}\n`;
  }

  content = content.replace(/(\n\s*variantKey\s+String\s*\n)\s*storageDriver\s+String\s*\n\s*storageKey\s+String\s*\n/m, '$1  blobId       String\n');
  if (content.includes('model FileVariant {') && !content.includes('blob         FileBlob')) {
    content = content.replace(
      /(\n\s*file\s+FileRecord\s+@relation\(fields:\s*\[fileId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)\n)/m,
      '$1  blob         FileBlob   @relation(fields: [blobId], references: [id], onDelete: Restrict)\n',
    );
  }
  if (content.includes('model FileVariant {') && !content.includes('@@index([blobId])')) {
    content = content.replace(/(\n\s*@@unique\(\[fileId,\s*variantKey\]\)\n)/m, '$1  @@index([blobId])\n');
  }

  if (!content.includes('model FileBlob {')) {
    const model = `
model FileBlob {
  id           String   @id @default(cuid())
  hash         String
  size         Int
  mimeType     String
  storageDriver String
  storageKey   String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  variants     FileVariant[]

  @@unique([hash, size, mimeType, storageDriver])
  @@index([storageDriver, createdAt])
}
`;
    content = `${content.trimEnd()}\n\n${model.trim()}\n`;
  }

  fs.writeFileSync(schemaPath, content, 'utf8');
}

function copyMigrationFolder(packageRoot, targetRoot, migrationName) {
  const migrationDir = path.join(targetRoot, 'apps', 'api', 'prisma', 'migrations', migrationName);
  const migrationFile = path.join(migrationDir, 'migration.sql');
  if (fs.existsSync(migrationFile)) {
    return;
  }

  const sourceDir = path.join(packageRoot, 'templates', 'module-presets', 'files', 'apps', 'api', 'prisma', 'migrations', migrationName);
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  fs.mkdirSync(path.dirname(migrationDir), { recursive: true });
  copyRecursive(sourceDir, migrationDir);
}

function patchPrismaMigration(packageRoot, targetRoot) {
  copyMigrationFolder(packageRoot, targetRoot, '20260306_files_file_record');
  copyMigrationFolder(packageRoot, targetRoot, '20260306_files_file_variant');
}

function patchAppModule(targetRoot) {
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  content = ensureImportLine(
    content,
    "import { filesConfig, filesEnvSchema, ForgeonFilesModule } from '@forgeon/files';",
  );
  content = ensureLoadItem(content, 'filesConfig');
  content = ensureValidatorSchema(content, 'filesEnvSchema');

  if (!content.includes('    ForgeonFilesModule,')) {
    if (content.includes('    ForgeonI18nModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonI18nModule.register({', '    ForgeonFilesModule,');
    } else if (content.includes('    ForgeonAuthModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonAuthModule.register({', '    ForgeonFilesModule,');
    } else if (content.includes('    ForgeonAuthModule.register(),')) {
      content = ensureLineBefore(content, '    ForgeonAuthModule.register(),', '    ForgeonFilesModule,');
    } else if (content.includes('    DbPrismaModule,')) {
      content = ensureLineAfter(content, '    DbPrismaModule,', '    ForgeonFilesModule,');
    } else if (content.includes('    ForgeonLoggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonLoggerModule,', '    ForgeonFilesModule,');
    } else if (content.includes('    ForgeonSwaggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonSwaggerModule,', '    ForgeonFilesModule,');
    } else {
      content = ensureLineAfter(content, '    CoreErrorsModule,', '    ForgeonFilesModule,');
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
    'COPY packages/rbac/package.json packages/rbac/package.json',
    'COPY packages/rate-limit/package.json packages/rate-limit/package.json',
    'COPY packages/logger/package.json packages/logger/package.json',
    'COPY packages/swagger/package.json packages/swagger/package.json',
    'COPY packages/i18n/package.json packages/i18n/package.json',
    'COPY packages/db-prisma/package.json packages/db-prisma/package.json',
    'COPY packages/core/package.json packages/core/package.json',
  ];
  const packageAnchor = packageAnchors.find((line) => content.includes(line)) ?? packageAnchors.at(-1);
  content = ensureLineAfter(content, packageAnchor, 'COPY packages/files/package.json packages/files/package.json');

  const sourceAnchors = [
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
  content = ensureLineAfter(content, sourceAnchor, 'COPY packages/files packages/files');

  content = content.replace(/^RUN pnpm --filter @forgeon\/files build\r?\n?/gm, '');
  const buildAnchor = content.includes('RUN pnpm --filter @forgeon/api prisma:generate')
    ? 'RUN pnpm --filter @forgeon/api prisma:generate'
    : 'RUN pnpm --filter @forgeon/api build';
  content = ensureLineBefore(content, buildAnchor, 'RUN pnpm --filter @forgeon/files build');

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchHealthController(targetRoot) {
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  content = ensureNestCommonImport(content, 'Post');
  content = ensureNestCommonImport(content, 'Get');
  content = ensureImportLine(content, "import { FilesService } from '@forgeon/files';");

  if (!content.includes('private readonly filesService: FilesService')) {
    const constructorMatch = content.match(/constructor\(([\s\S]*?)\)\s*\{/m);
    if (constructorMatch) {
      const original = constructorMatch[0];
      const inner = constructorMatch[1].trimEnd();
      const normalizedInner = inner.replace(/,\s*$/, '');
      const separator = normalizedInner.length > 0 ? ',' : '';
      const next = `constructor(${normalizedInner}${separator}
    private readonly filesService: FilesService,
  ) {`;
      content = content.replace(original, next);
    } else {
      const classAnchor = 'export class HealthController {';
      if (content.includes(classAnchor)) {
        content = content.replace(
          classAnchor,
          `${classAnchor}
  constructor(private readonly filesService: FilesService) {}
`,
        );
      }
    }
  }

  if (!content.includes("@Post('files')")) {
    const method = `
  @Post('files')
  async getFilesProbe() {
    const record = await this.filesService.createProbeRecord();
    await this.filesService.deleteByPublicId(record.publicId);
    return {
      status: 'ok',
      feature: 'files',
      file: {
        publicId: record.publicId,
        mimeType: record.mimeType,
        size: record.size,
      },
      cleanup: 'done',
    };
  }
`;
    content = ensureClassMember(content, 'HealthController', method, { beforeNeedle: 'private translate(' });
  }

  if (!content.includes("@Get('files-variants')")) {
    const method = `
  @Get('files-variants')
  async getFilesVariantsProbe() {
    return this.filesService.getVariantsProbeStatus();
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

  if (!content.includes('filesProbeResult')) {
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
        '  const [filesProbeResult, setFilesProbeResult] = useState<ProbeResult | null>(null);',
      );
    }
  }

  if (!content.includes('filesVariantsProbeResult')) {
    const stateAnchors = [
      '  const [filesProbeResult, setFilesProbeResult] = useState<ProbeResult | null>(null);',
      '  const [validationProbeResult, setValidationProbeResult] = useState<ProbeResult | null>(null);',
    ];
    const stateAnchor = stateAnchors.find((line) => content.includes(line));
    if (stateAnchor) {
      content = ensureLineAfter(
        content,
        stateAnchor,
        '  const [filesVariantsProbeResult, setFilesVariantsProbeResult] = useState<ProbeResult | null>(null);',
      );
    }
  }

  if (!content.includes('Check files probe (create metadata)')) {
    const probePath = content.includes("runProbe(setHealthResult, '/health')")
      ? '/health/files'
      : '/api/health/files';
    const button = `        <button onClick={() => runProbe(setFilesProbeResult, '${probePath}', { method: 'POST' })}>\n          Check files probe (create metadata)\n        </button>`;

    const actionsStart = content.indexOf('<div className="actions">');
    if (actionsStart >= 0) {
      const actionsEnd = content.indexOf('\n      </div>', actionsStart);
      if (actionsEnd >= 0) {
        content = `${content.slice(0, actionsEnd)}\n${button}${content.slice(actionsEnd)}`;
      }
    }
  }

  if (!content.includes("{renderResult('Files probe response', filesProbeResult)}")) {
    const resultLine = "      {renderResult('Files probe response', filesProbeResult)}";
    const networkLine = '      {networkError ? <p className="error">{networkError}</p> : null}';
    if (content.includes(networkLine)) {
      content = content.replace(networkLine, `${resultLine}\n${networkLine}`);
    } else {
      const anchor = "{renderResult('Validation probe response', validationProbeResult)}";
      if (content.includes(anchor)) {
        content = ensureLineAfter(content, anchor, resultLine);
      }
    }
  }

  if (!content.includes('Check files variants capability')) {
    const probePath = content.includes("runProbe(setHealthResult, '/health')")
      ? '/health/files-variants'
      : '/api/health/files-variants';
    const button = `        <button onClick={() => runProbe(setFilesVariantsProbeResult, '${probePath}')}>\n          Check files variants capability\n        </button>`;

    const actionsStart = content.indexOf('<div className="actions">');
    if (actionsStart >= 0) {
      const actionsEnd = content.indexOf('\n      </div>', actionsStart);
      if (actionsEnd >= 0) {
        content = `${content.slice(0, actionsEnd)}\n${button}${content.slice(actionsEnd)}`;
      }
    }
  }

  if (!content.includes("{renderResult('Files variants probe response', filesVariantsProbeResult)}")) {
    const resultLine = "      {renderResult('Files variants probe response', filesVariantsProbeResult)}";
    const networkLine = '      {networkError ? <p className="error">{networkError}</p> : null}';
    if (content.includes(networkLine)) {
      content = content.replace(networkLine, `${resultLine}\n${networkLine}`);
    } else {
      const anchor = "{renderResult('Files probe response', filesProbeResult)}";
      if (content.includes(anchor)) {
        content = ensureLineAfter(content, anchor, resultLine);
      }
    }
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchCompose(targetRoot) {
  const composePath = path.join(targetRoot, 'infra', 'docker', 'compose.yml');
  if (!fs.existsSync(composePath)) {
    return;
  }

  let content = fs.readFileSync(composePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes('FILES_ENABLED: ${FILES_ENABLED}')) {
    const anchors = [
      /^(\s+AUTH_DEMO_PASSWORD:.*)$/m,
      /^(\s+THROTTLE_TRUST_PROXY:.*)$/m,
      /^(\s+LOGGER_LEVEL:.*)$/m,
      /^(\s+SWAGGER_ENABLED:.*)$/m,
      /^(\s+I18N_FALLBACK_LANG:.*)$/m,
      /^(\s+DATABASE_URL:.*)$/m,
      /^(\s+API_PREFIX:.*)$/m,
    ];
    const anchorPattern = anchors.find((pattern) => pattern.test(content)) ?? anchors.at(-1);
    content = content.replace(
      anchorPattern,
      `$1
      FILES_ENABLED: \${FILES_ENABLED}
      FILES_STORAGE_DRIVER: \${FILES_STORAGE_DRIVER}
      FILES_PUBLIC_BASE_PATH: \${FILES_PUBLIC_BASE_PATH}
      FILES_MAX_FILE_SIZE_BYTES: \${FILES_MAX_FILE_SIZE_BYTES}
      FILES_ALLOWED_MIME_PREFIXES: \${FILES_ALLOWED_MIME_PREFIXES}`,
    );
  }

  fs.writeFileSync(composePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const marker = '## Files Module';
  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  if (content.includes(marker)) {
    return;
  }

  const section = `## Files Module

The files module adds runtime file endpoints with DB-backed metadata and storage-driver-aware behavior.

What it currently adds:
- \`@forgeon/files\` package with:
  - upload endpoint (\`POST /api/files/upload\`)
  - metadata endpoint (\`GET /api/files/:publicId\`)
  - download endpoint (\`GET /api/files/:publicId/download?variant=original|preview\`)
- delete endpoint (\`DELETE /api/files/:publicId\`)
- Prisma \`FileRecord\` model and migration template (with owner/visibility indexes)
- Prisma \`FileVariant\` model for \`original\` and optional \`preview\` variants
- Prisma \`FileBlob\` model for dedup and shared physical content
- probe endpoints:
  - \`POST /api/health/files\`
  - \`GET /api/health/files-variants\`

Current limits:
- local storage runtime is implemented
- S3 runtime is available when \`files-s3\` module is installed and \`FILES_STORAGE_DRIVER=s3\`
- strict access control and quotas are provided by separate add-modules (\`files-access\`, \`files-quotas\`)
- image sanitize pipeline is provided by separate add-module (\`files-image\`)
- \`create-forgeon add files\` recommends installing \`files-image\` during the same flow (TTY default: Yes)
- \`preview\` variant is generated only when \`files-image\` is installed
- dedup is applied to \`original\` uploads by content hash (\`sha256 + size + mime + driver\`)
- files probe does create+cleanup to avoid leftover storage artifacts

Dependency model:
- requires \`db-adapter\`
- requires \`files-storage-adapter\` (for example: \`files-local\` or \`files-s3\`)

Key env:
- \`FILES_ENABLED=true\`
- \`FILES_STORAGE_DRIVER=local\`
- \`FILES_PUBLIC_BASE_PATH=/files\`
- \`FILES_MAX_FILE_SIZE_BYTES=10485760\`
- \`FILES_ALLOWED_MIME_PREFIXES=image/,application/pdf,text/\``;

  if (content.includes('## Prisma In Docker Start')) {
    content = content.replace('## Prisma In Docker Start', `${section}\n\n## Prisma In Docker Start`);
  } else {
    content = `${content.trimEnd()}\n\n${section}\n`;
  }

  fs.writeFileSync(readmePath, `${content.trimEnd()}\n`, 'utf8');
}

export function applyFilesModule({ packageRoot, targetRoot }) {
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'files'));

  patchApiPackage(targetRoot);
  patchPrismaSchema(targetRoot);
  patchPrismaMigration(packageRoot, targetRoot);
  patchAppModule(targetRoot);
  patchHealthController(targetRoot);
  patchWebApp(targetRoot);
  patchApiDockerfile(targetRoot);
  patchCompose(targetRoot);
  patchReadme(targetRoot);

  upsertEnvLines(path.join(targetRoot, 'apps', 'api', '.env.example'), [
    'FILES_ENABLED=true',
    'FILES_STORAGE_DRIVER=local',
    'FILES_PUBLIC_BASE_PATH=/files',
    'FILES_MAX_FILE_SIZE_BYTES=10485760',
    'FILES_ALLOWED_MIME_PREFIXES=image/,application/pdf,text/',
  ]);
  upsertEnvLines(path.join(targetRoot, 'infra', 'docker', '.env.example'), [
    'FILES_ENABLED=true',
    'FILES_STORAGE_DRIVER=local',
    'FILES_PUBLIC_BASE_PATH=/files',
    'FILES_MAX_FILE_SIZE_BYTES=10485760',
    'FILES_ALLOWED_MIME_PREFIXES=image/,application/pdf,text/',
  ]);
}
