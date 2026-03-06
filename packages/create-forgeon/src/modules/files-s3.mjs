import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive, writeJson } from '../utils/fs.mjs';
import {
  ensureBuildSteps,
  ensureDependency,
  ensureImportLine,
  ensureLineAfter,
  ensureLineBefore,
  ensureLoadItem,
  ensureValidatorSchema,
  upsertEnvLines,
} from './shared/patch-utils.mjs';

function copyFromPreset(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'module-presets', 'files-s3', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing files-s3 preset template: ${source}`);
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
  ensureDependency(packageJson, '@forgeon/files-s3', 'workspace:*');
  ensureBuildSteps(packageJson, 'predev', ['pnpm --filter @forgeon/files-s3 build']);
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
    "import { filesS3Config, filesS3EnvSchemaZod, FilesS3ConfigModule } from '@forgeon/files-s3';",
  );
  content = ensureLoadItem(content, 'filesS3Config');
  content = ensureValidatorSchema(content, 'filesS3EnvSchemaZod');

  if (!content.includes('    FilesS3ConfigModule,')) {
    if (content.includes('    ForgeonFilesModule,')) {
      content = ensureLineAfter(content, '    ForgeonFilesModule,', '    FilesS3ConfigModule,');
    } else if (content.includes('    ForgeonI18nModule.register({')) {
      content = ensureLineBefore(content, '    ForgeonI18nModule.register({', '    FilesS3ConfigModule,');
    } else if (content.includes('    DbPrismaModule,')) {
      content = ensureLineAfter(content, '    DbPrismaModule,', '    FilesS3ConfigModule,');
    } else if (content.includes('    ForgeonLoggerModule,')) {
      content = ensureLineAfter(content, '    ForgeonLoggerModule,', '    FilesS3ConfigModule,');
    } else {
      content = ensureLineAfter(content, '    CoreErrorsModule,', '    FilesS3ConfigModule,');
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
    'COPY packages/files-s3/package.json packages/files-s3/package.json',
  );

  const sourceAnchors = [
    'COPY packages/files packages/files',
    'COPY packages/files-local packages/files-local',
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
  content = ensureLineAfter(content, sourceAnchor, 'COPY packages/files-s3 packages/files-s3');

  content = content.replace(/^RUN pnpm --filter @forgeon\/files-s3 build\r?\n?/gm, '');
  const buildAnchor = content.includes('RUN pnpm --filter @forgeon/api prisma:generate')
    ? 'RUN pnpm --filter @forgeon/api prisma:generate'
    : 'RUN pnpm --filter @forgeon/api build';
  content = ensureLineBefore(content, buildAnchor, 'RUN pnpm --filter @forgeon/files-s3 build');

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchCompose(targetRoot) {
  const composePath = path.join(targetRoot, 'infra', 'docker', 'compose.yml');
  if (!fs.existsSync(composePath)) {
    return;
  }

  let content = fs.readFileSync(composePath, 'utf8').replace(/\r\n/g, '\n');
  const anchors = [
    '      FILES_LOCAL_ROOT: ${FILES_LOCAL_ROOT}',
    '      FILES_PUBLIC_BASE_PATH: ${FILES_PUBLIC_BASE_PATH}',
    '      FILES_STORAGE_DRIVER: ${FILES_STORAGE_DRIVER}',
    '      FILES_ENABLED: ${FILES_ENABLED}',
    '      API_PREFIX: ${API_PREFIX}',
  ];
  const initialAnchor = anchors.find((line) => content.includes(line)) ?? anchors.at(-1);
  const envLines = [
    '      FILES_S3_PROVIDER_PRESET: ${FILES_S3_PROVIDER_PRESET}',
    '      FILES_S3_BUCKET: ${FILES_S3_BUCKET}',
    '      FILES_S3_REGION: ${FILES_S3_REGION}',
    '      FILES_S3_ENDPOINT: ${FILES_S3_ENDPOINT}',
    '      FILES_S3_ACCESS_KEY_ID: ${FILES_S3_ACCESS_KEY_ID}',
    '      FILES_S3_SECRET_ACCESS_KEY: ${FILES_S3_SECRET_ACCESS_KEY}',
    '      FILES_S3_FORCE_PATH_STYLE: ${FILES_S3_FORCE_PATH_STYLE}',
    '      FILES_S3_MAX_ATTEMPTS: ${FILES_S3_MAX_ATTEMPTS}',
  ];
  let previous = initialAnchor;
  for (const line of envLines) {
    content = ensureLineAfter(content, previous, line);
    previous = line;
  }

  fs.writeFileSync(composePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const marker = '## Files S3 Adapter Module';
  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  if (content.includes(marker)) {
    return;
  }

  const section = `## Files S3 Adapter Module

The files-s3 module provides the \`files-storage-adapter\` capability for S3-compatible object storage.

It supports runtime storage for:
- AWS S3
- Cloudflare R2
- MinIO
- other S3-compatible endpoints

Configuration:
- \`FILES_S3_PROVIDER_PRESET\` (\`minio | r2 | aws | custom\`)
- \`FILES_S3_BUCKET\`
- \`FILES_S3_REGION\`
- \`FILES_S3_ENDPOINT\`
- \`FILES_S3_ACCESS_KEY_ID\`
- \`FILES_S3_SECRET_ACCESS_KEY\`
- \`FILES_S3_FORCE_PATH_STYLE\`
- \`FILES_S3_MAX_ATTEMPTS\`

Preset defaults:
- \`minio\`: endpoint \`http://localhost:9000\`, region \`auto\`, path-style \`true\`
- \`aws\`: region \`eu-central-1\` (EU/de), endpoint optional, path-style \`false\`
- \`r2\`: region \`auto\`, endpoint should be set explicitly, path-style \`false\`
- \`custom\`: region \`eu-central-1\` (EU/de), endpoint should be set explicitly, path-style \`false\`

Environment overrides:
- Leave \`FILES_S3_REGION\`, \`FILES_S3_ENDPOINT\`, or \`FILES_S3_FORCE_PATH_STYLE\` empty to use preset defaults.
- Set explicit values when provider-specific tuning is needed.

When added before \`files\`, this module sets \`FILES_STORAGE_DRIVER=s3\` in env examples.`;

  if (content.includes('## Prisma In Docker Start')) {
    content = content.replace('## Prisma In Docker Start', `${section}\n\n## Prisma In Docker Start`);
  } else {
    content = `${content.trimEnd()}\n\n${section}\n`;
  }

  fs.writeFileSync(readmePath, `${content.trimEnd()}\n`, 'utf8');
}

function setEnvValue(filePath, key, value) {
  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  }

  const lines = content.length > 0 ? content.split('\n') : [];
  const keyPrefix = `${key}=`;
  let updated = false;
  const nextLines = lines.map((line) => {
    if (!line.startsWith(keyPrefix)) {
      return line;
    }
    updated = true;
    const currentValue = line.slice(keyPrefix.length);
    if (currentValue === '' || currentValue === 'local') {
      return `${key}=${value}`;
    }
    return line;
  });

  if (!updated) {
    nextLines.push(`${key}=${value}`);
  }

  const nextContent = `${nextLines.join('\n').trimEnd()}\n`;
  fs.writeFileSync(filePath, nextContent, 'utf8');
}

export function applyFilesS3Module({ packageRoot, targetRoot }) {
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'files-s3'));

  patchApiPackage(targetRoot);
  patchAppModule(targetRoot);
  patchApiDockerfile(targetRoot);
  patchCompose(targetRoot);
  patchReadme(targetRoot);

  upsertEnvLines(path.join(targetRoot, 'apps', 'api', '.env.example'), [
    'FILES_S3_PROVIDER_PRESET=minio',
    'FILES_S3_BUCKET=forgeon-files',
    'FILES_S3_REGION=',
    'FILES_S3_ENDPOINT=',
    'FILES_S3_ACCESS_KEY_ID=forgeon',
    'FILES_S3_SECRET_ACCESS_KEY=forgeon-secret',
    'FILES_S3_FORCE_PATH_STYLE=',
    'FILES_S3_MAX_ATTEMPTS=3',
  ]);
  upsertEnvLines(path.join(targetRoot, 'infra', 'docker', '.env.example'), [
    'FILES_S3_PROVIDER_PRESET=minio',
    'FILES_S3_BUCKET=forgeon-files',
    'FILES_S3_REGION=',
    'FILES_S3_ENDPOINT=',
    'FILES_S3_ACCESS_KEY_ID=forgeon',
    'FILES_S3_SECRET_ACCESS_KEY=forgeon-secret',
    'FILES_S3_FORCE_PATH_STYLE=',
    'FILES_S3_MAX_ATTEMPTS=3',
  ]);

  setEnvValue(path.join(targetRoot, 'apps', 'api', '.env.example'), 'FILES_STORAGE_DRIVER', 's3');
  setEnvValue(path.join(targetRoot, 'infra', 'docker', '.env.example'), 'FILES_STORAGE_DRIVER', 's3');
}
