import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addModule } from './executor.mjs';
import { scanIntegrations, syncIntegrations } from './sync-integrations.mjs';
import { scaffoldProject } from '../core/scaffold.mjs';

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createMinimalForgeonProject(targetRoot) {
  fs.mkdirSync(path.join(targetRoot, 'apps', 'api'), { recursive: true });
  fs.writeFileSync(path.join(targetRoot, 'package.json'), '{"name":"demo"}\n', 'utf8');
  fs.writeFileSync(path.join(targetRoot, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n', 'utf8');
}

function assertDbPrismaWiring(projectRoot) {
  const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
  assert.match(appModule, /dbPrismaConfig/);
  assert.match(appModule, /dbPrismaEnvSchema/);
  assert.match(appModule, /DbPrismaModule/);

  const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
  assert.match(apiPackage, /@forgeon\/db-prisma/);

  const apiDockerfile = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'Dockerfile'), 'utf8');
  assert.match(apiDockerfile, /COPY packages\/db-prisma\/package\.json packages\/db-prisma\/package\.json/);
  assert.match(apiDockerfile, /COPY packages\/db-prisma packages\/db-prisma/);
  assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/db-prisma build/);

  const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
  assert.match(compose, /DATABASE_URL: \$\{DATABASE_URL\}/);

  const healthController = fs.readFileSync(
    path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
    'utf8',
  );
  assert.match(healthController, /PrismaService/);
}

function assertRateLimitWiring(projectRoot) {
  const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
  assert.match(appModule, /rateLimitConfig/);
  assert.match(appModule, /rateLimitEnvSchema/);
  assert.match(appModule, /ForgeonRateLimitModule/);

  const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
  assert.match(apiPackage, /@forgeon\/rate-limit/);
  assert.match(apiPackage, /pnpm --filter @forgeon\/rate-limit build/);

  const apiDockerfile = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'Dockerfile'), 'utf8');
  assert.match(apiDockerfile, /COPY packages\/rate-limit\/package\.json packages\/rate-limit\/package\.json/);
  assert.match(apiDockerfile, /COPY packages\/rate-limit packages\/rate-limit/);
  assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/rate-limit build/);

  const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
  assert.match(compose, /THROTTLE_ENABLED: \$\{THROTTLE_ENABLED\}/);
  assert.match(compose, /THROTTLE_LIMIT: \$\{THROTTLE_LIMIT\}/);

  const apiEnv = fs.readFileSync(path.join(projectRoot, 'apps', 'api', '.env.example'), 'utf8');
  assert.match(apiEnv, /THROTTLE_ENABLED=true/);
  assert.match(apiEnv, /THROTTLE_TTL=10/);
  assert.match(apiEnv, /THROTTLE_LIMIT=3/);

  const healthController = fs.readFileSync(
    path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
    'utf8',
  );
  assert.match(healthController, /import \{ Header \} from '@nestjs\/common';/);
  assert.match(healthController, /@Header\('Cache-Control', 'no-store, no-cache, must-revalidate'\)/);
  assert.match(healthController, /@Get\('rate-limit'\)/);
  assert.match(healthController, /TOO_MANY_REQUESTS/);

  const appTsx = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'App.tsx'), 'utf8');
  assert.match(appTsx, /cache: 'no-store'/);
  assert.match(appTsx, /Check rate limit \(click repeatedly\)/);
  assert.match(appTsx, /Rate limit probe response/);

  const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
  assert.match(readme, /## Rate Limit Module/);
  assert.match(readme, /installs independently/i);
  assert.match(readme, /no optional integration sync is required/i);
}

function assertQueueWiring(projectRoot) {
  const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
  assert.match(appModule, /queueConfig/);
  assert.match(appModule, /queueEnvSchema/);
  assert.match(appModule, /ForgeonQueueModule/);

  const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
  assert.match(apiPackage, /@forgeon\/queue/);
  assert.match(apiPackage, /pnpm --filter @forgeon\/queue build/);

  const apiDockerfile = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'Dockerfile'), 'utf8');
  assert.match(apiDockerfile, /COPY packages\/queue\/package\.json packages\/queue\/package\.json/);
  assert.match(apiDockerfile, /COPY packages\/queue packages\/queue/);
  assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/queue build/);

  const healthController = fs.readFileSync(
    path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
    'utf8',
  );
  assert.match(healthController, /QueueService/);
  assert.match(healthController, /@Get\('queue'\)/);
  assert.match(healthController, /queueService\.getProbeStatus/);

  const webApp = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'App.tsx'), 'utf8');
  assert.match(webApp, /Check queue health/);
  assert.match(webApp, /Queue probe response/);

  const apiEnv = fs.readFileSync(path.join(projectRoot, 'apps', 'api', '.env.example'), 'utf8');
  assert.match(apiEnv, /QUEUE_ENABLED=true/);
  assert.match(apiEnv, /QUEUE_REDIS_URL=redis:\/\/localhost:6379/);
  assert.match(apiEnv, /QUEUE_DEFAULT_ATTEMPTS=3/);
  assert.match(apiEnv, /QUEUE_DEFAULT_BACKOFF_MS=1000/);

  const dockerEnv = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', '.env.example'), 'utf8');
  assert.match(dockerEnv, /QUEUE_REDIS_URL=redis:\/\/redis:6379/);

  const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
  assert.match(compose, /^\s{2}redis:\s*$/m);
  assert.match(compose, /QUEUE_ENABLED: \$\{QUEUE_ENABLED\}/);
  assert.match(compose, /depends_on:\n\s+redis:\n\s+condition: service_healthy/);

  const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
  assert.match(readme, /## Queue Module/);
  assert.match(readme, /runtime baseline backed by Redis/i);
}

function assertRbacWiring(projectRoot) {
  const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
  assert.match(appModule, /ForgeonRbacModule/);

  const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
  assert.match(apiPackage, /@forgeon\/rbac/);
  assert.match(apiPackage, /pnpm --filter @forgeon\/rbac build/);

  const apiDockerfile = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'Dockerfile'), 'utf8');
  assert.match(apiDockerfile, /COPY packages\/rbac\/package\.json packages\/rbac\/package\.json/);
  assert.match(apiDockerfile, /COPY packages\/rbac packages\/rbac/);
  assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/rbac build/);

  const healthController = fs.readFileSync(
    path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
    'utf8',
  );
  assert.match(healthController, /UseGuards/);
  assert.match(healthController, /ForgeonRbacGuard/);
  assert.match(healthController, /@Get\('rbac'\)/);
  assert.match(healthController, /@Permissions\('health\.rbac'\)/);

  const appTsx = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'App.tsx'), 'utf8');
  assert.match(appTsx, /Check RBAC access/);
  assert.match(appTsx, /RBAC probe response/);
  assert.match(appTsx, /x-forgeon-permissions/);

  const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
  assert.match(readme, /## RBAC \/ Permissions Module/);
  assert.match(readme, /installs independently/i);
  assert.match(readme, /jwt-auth.*optional/i);
}

function assertFilesWiring(projectRoot, expectedStorageDriver = 'local') {
  const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
  assert.match(appModule, /filesConfig/);
  assert.match(appModule, /filesEnvSchema/);
  assert.match(appModule, /ForgeonFilesModule/);

  const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
  assert.match(apiPackage, /@forgeon\/files/);
  assert.match(apiPackage, /pnpm --filter @forgeon\/files build/);

  const apiDockerfile = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'Dockerfile'), 'utf8');
  assert.match(apiDockerfile, /COPY packages\/files\/package\.json packages\/files\/package\.json/);
  assert.match(apiDockerfile, /COPY packages\/files packages\/files/);
  assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/files build/);

  const apiEnv = fs.readFileSync(path.join(projectRoot, 'apps', 'api', '.env.example'), 'utf8');
  assert.match(apiEnv, /FILES_ENABLED=true/);
  assert.match(apiEnv, new RegExp(`FILES_STORAGE_DRIVER=${expectedStorageDriver}`));
  assert.match(apiEnv, /FILES_PUBLIC_BASE_PATH=\/files/);
  assert.match(apiEnv, /FILES_MAX_FILE_SIZE_BYTES=10485760/);
  assert.match(apiEnv, /FILES_ALLOWED_MIME_PREFIXES=image\/,application\/pdf,text\//);

  const healthController = fs.readFileSync(
    path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
    'utf8',
  );
  assert.match(healthController, /@Post\('files'\)/);
  assert.match(healthController, /@Get\('files-variants'\)/);
  assert.match(healthController, /filesService\.createProbeRecord/);
  assert.match(healthController, /filesService\.getVariantsProbeStatus/);
  assert.match(healthController, /filesService\.deleteByPublicId/);

  const filesController = fs.readFileSync(
    path.join(projectRoot, 'packages', 'files', 'src', 'files.controller.ts'),
    'utf8',
  );
  assert.match(filesController, /@Query\('variant'\) variantQuery\?: string/);
  assert.match(filesController, /parseVariant\(variantQuery\)/);
  assert.match(filesController, /@Delete\(':publicId'\)/);

  const filesService = fs.readFileSync(
    path.join(projectRoot, 'packages', 'files', 'src', 'files.service.ts'),
    'utf8',
  );
  assert.match(filesService, /getOrCreateBlob/);
  assert.match(filesService, /cleanupReferencedBlobs/);
  assert.match(filesService, /isUniqueConstraintError/);
  assert.match(filesService, /fileBlob\.deleteMany/);
  assert.match(filesService, /variants:\s*\{[\s\S]*?none:\s*\{[\s\S]*?\}/);
  assert.match(filesService, /prisma\.fileBlob/);

  const appTsx = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'App.tsx'), 'utf8');
  assert.match(appTsx, /Check files probe \(create metadata\)/);
  assert.match(appTsx, /Check files variants capability/);
  assert.match(appTsx, /Files probe response/);
  assert.match(appTsx, /Files variants probe response/);

  const schema = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'prisma', 'schema.prisma'), 'utf8');
  assert.match(schema, /model FileRecord \{/);
  assert.match(schema, /variants\s+FileVariant\[\]/);
  assert.match(schema, /model FileVariant \{/);
  assert.match(schema, /model FileBlob \{/);
  assert.match(schema, /blobId\s+String/);
  assert.match(schema, /@@unique\(\[hash,\s*size,\s*mimeType,\s*storageDriver\]\)/);
  assert.match(schema, /@@unique\(\[fileId,\s*variantKey\]\)/);
  assert.match(schema, /publicId\s+String\s+@unique/);
  assert.match(schema, /@@index\(\[ownerType,\s*ownerId,\s*createdAt\]\)/);

  const migration = path.join(
    projectRoot,
    'apps',
    'api',
    'prisma',
    'migrations',
    '20260306_files_file_record',
    'migration.sql',
  );
  assert.equal(fs.existsSync(migration), true);

  const variantMigration = path.join(
    projectRoot,
    'apps',
    'api',
    'prisma',
    'migrations',
    '20260306_files_file_variant',
    'migration.sql',
  );
  assert.equal(fs.existsSync(variantMigration), true);
}

function assertFilesLocalWiring(projectRoot) {
  const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
  assert.match(appModule, /filesLocalConfig/);
  assert.match(appModule, /filesLocalEnvSchemaZod/);
  assert.match(appModule, /FilesLocalConfigModule/);

  const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
  assert.match(apiPackage, /@forgeon\/files-local/);
  assert.match(apiPackage, /pnpm --filter @forgeon\/files-local build/);

  const apiDockerfile = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'Dockerfile'), 'utf8');
  assert.match(apiDockerfile, /COPY packages\/files-local\/package\.json packages\/files-local\/package\.json/);
  assert.match(apiDockerfile, /COPY packages\/files-local packages\/files-local/);
  assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/files-local build/);

  const apiEnv = fs.readFileSync(path.join(projectRoot, 'apps', 'api', '.env.example'), 'utf8');
  assert.match(apiEnv, /FILES_LOCAL_ROOT=storage\/uploads/);

  const gitignore = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8');
  assert.match(gitignore, /storage\//);

  const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
  assert.match(compose, /files_data:\/app\/storage/);
  assert.match(compose, /^\s{2}files_data:\s*$/m);
}

function assertFilesS3Wiring(projectRoot) {
  const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
  assert.match(appModule, /filesS3Config/);
  assert.match(appModule, /filesS3EnvSchemaZod/);
  assert.match(appModule, /FilesS3ConfigModule/);

  const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
  assert.match(apiPackage, /@forgeon\/files-s3/);
  assert.match(apiPackage, /pnpm --filter @forgeon\/files-s3 build/);

  const apiDockerfile = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'Dockerfile'), 'utf8');
  assert.match(apiDockerfile, /COPY packages\/files-s3\/package\.json packages\/files-s3\/package\.json/);
  assert.match(apiDockerfile, /COPY packages\/files-s3 packages\/files-s3/);
  assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/files-s3 build/);

  const apiEnv = fs.readFileSync(path.join(projectRoot, 'apps', 'api', '.env.example'), 'utf8');
  assert.match(apiEnv, /FILES_STORAGE_DRIVER=s3/);
  assert.match(apiEnv, /FILES_S3_PROVIDER_PRESET=minio/);
  assert.match(apiEnv, /FILES_S3_BUCKET=forgeon-files/);
  assert.match(apiEnv, /FILES_S3_REGION=/);
  assert.match(apiEnv, /FILES_S3_ENDPOINT=/);
  assert.match(apiEnv, /FILES_S3_FORCE_PATH_STYLE=/);
  assert.match(apiEnv, /FILES_S3_MAX_ATTEMPTS=3/);

  const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
  assert.match(compose, /FILES_S3_PROVIDER_PRESET: \$\{FILES_S3_PROVIDER_PRESET\}/);
  assert.match(compose, /FILES_S3_MAX_ATTEMPTS: \$\{FILES_S3_MAX_ATTEMPTS\}/);

  const filesS3Package = fs.readFileSync(
    path.join(projectRoot, 'packages', 'files-s3', 'package.json'),
    'utf8',
  );
  assert.match(filesS3Package, /@aws-sdk\/client-s3/);
}

function assertFilesAccessWiring(projectRoot) {
  const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
  assert.match(appModule, /ForgeonFilesAccessModule/);

  const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
  assert.match(apiPackage, /@forgeon\/files-access/);
  assert.match(apiPackage, /pnpm --filter @forgeon\/files-access build/);
  assert.equal(
    apiPackage.indexOf('pnpm --filter @forgeon/files-access build') <
      apiPackage.indexOf('pnpm --filter @forgeon/files build'),
    true,
  );

  const filesPackage = fs.readFileSync(path.join(projectRoot, 'packages', 'files', 'package.json'), 'utf8');
  assert.match(filesPackage, /@forgeon\/files-access/);

  const apiDockerfile = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'Dockerfile'), 'utf8');
  assert.match(
    apiDockerfile,
    /COPY packages\/files-access\/package\.json packages\/files-access\/package\.json/,
  );
  assert.match(apiDockerfile, /COPY packages\/files-access packages\/files-access/);
  assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/files-access build/);
  assert.equal(
    apiDockerfile.indexOf('RUN pnpm --filter @forgeon/files-access build') <
      apiDockerfile.indexOf('RUN pnpm --filter @forgeon/files build'),
    true,
  );

  const filesController = fs.readFileSync(
    path.join(projectRoot, 'packages', 'files', 'src', 'files.controller.ts'),
    'utf8',
  );
  assert.match(filesController, /extractFilesAccessSubject/);
  assert.match(filesController, /filesAccessService\.assertCanRead/);
  assert.match(filesController, /filesAccessService\.assertCanDelete/);
  assert.match(filesController, /@Req\(\) req: any/);
  assert.match(filesController, /openDownload\(publicId,\s*variant\)/);

  const healthController = fs.readFileSync(
    path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
    'utf8',
  );
  assert.match(healthController, /@Get\('files-access'\)/);
  assert.match(healthController, /extractFilesAccessSubject/);
  assert.match(healthController, /filesAccessService\.canRead/);

  const appTsx = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'App.tsx'), 'utf8');
  assert.match(appTsx, /Check files access/);
  assert.match(appTsx, /Files access probe response/);
  assert.match(appTsx, /x-forgeon-user-id/);

  const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
  assert.match(readme, /## Files Access Module/);
  assert.match(readme, /resource-level authorization/i);
}

function assertFilesQuotasWiring(projectRoot) {
  const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
  assert.match(appModule, /filesQuotasConfig/);
  assert.match(appModule, /filesQuotasEnvSchema/);
  assert.match(appModule, /ForgeonFilesQuotasModule/);

  const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
  assert.match(apiPackage, /@forgeon\/files-quotas/);
  assert.match(apiPackage, /pnpm --filter @forgeon\/files-quotas build/);
  assert.equal(
    apiPackage.indexOf('pnpm --filter @forgeon/files-quotas build') <
      apiPackage.indexOf('pnpm --filter @forgeon/files build'),
    true,
  );

  const filesPackage = fs.readFileSync(path.join(projectRoot, 'packages', 'files', 'package.json'), 'utf8');
  assert.match(filesPackage, /@forgeon\/files-quotas/);

  const apiDockerfile = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'Dockerfile'), 'utf8');
  assert.match(
    apiDockerfile,
    /COPY packages\/files-quotas\/package\.json packages\/files-quotas\/package\.json/,
  );
  assert.match(apiDockerfile, /COPY packages\/files-quotas packages\/files-quotas/);
  assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/files-quotas build/);
  assert.equal(
    apiDockerfile.indexOf('RUN pnpm --filter @forgeon/files-quotas build') <
      apiDockerfile.indexOf('RUN pnpm --filter @forgeon/files build'),
    true,
  );

  const filesController = fs.readFileSync(
    path.join(projectRoot, 'packages', 'files', 'src', 'files.controller.ts'),
    'utf8',
  );
  assert.match(filesController, /FilesQuotasService/);
  assert.match(filesController, /filesQuotasService\.assertUploadAllowed/);

  const healthController = fs.readFileSync(
    path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
    'utf8',
  );
  assert.match(healthController, /@Get\('files-quotas'\)/);
  assert.match(healthController, /filesQuotasService\.getProbeStatus/);

  const appTsx = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'App.tsx'), 'utf8');
  assert.match(appTsx, /Check files quotas/);
  assert.match(appTsx, /Files quotas probe response/);

  const apiEnv = fs.readFileSync(path.join(projectRoot, 'apps', 'api', '.env.example'), 'utf8');
  assert.match(apiEnv, /FILES_QUOTAS_ENABLED=true/);
  assert.match(apiEnv, /FILES_QUOTA_MAX_FILES_PER_OWNER=100/);
  assert.match(apiEnv, /FILES_QUOTA_MAX_BYTES_PER_OWNER=104857600/);

  const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
  assert.match(compose, /FILES_QUOTAS_ENABLED: \$\{FILES_QUOTAS_ENABLED\}/);

  const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
  assert.match(readme, /## Files Quotas Module/);
  assert.match(readme, /owner-based limits/i);
}

function assertFilesImageWiring(projectRoot) {
  const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
  assert.match(appModule, /filesImageConfig/);
  assert.match(appModule, /filesImageEnvSchema/);
  assert.match(appModule, /ForgeonFilesImageModule/);

  const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
  assert.match(apiPackage, /@forgeon\/files-image/);
  assert.match(apiPackage, /pnpm --filter @forgeon\/files-image build/);
  assert.equal(
    apiPackage.indexOf('pnpm --filter @forgeon/files-image build') <
      apiPackage.indexOf('pnpm --filter @forgeon/files build'),
    true,
  );

  const filesPackage = fs.readFileSync(path.join(projectRoot, 'packages', 'files', 'package.json'), 'utf8');
  assert.match(filesPackage, /@forgeon\/files-image/);

  const filesModule = fs.readFileSync(
    path.join(projectRoot, 'packages', 'files', 'src', 'forgeon-files.module.ts'),
    'utf8',
  );
  assert.match(filesModule, /ForgeonFilesImageModule/);

  const filesService = fs.readFileSync(
    path.join(projectRoot, 'packages', 'files', 'src', 'files.service.ts'),
    'utf8',
  );
  assert.match(filesService, /FilesImageService/);
  assert.match(filesService, /filesImageService\.sanitizeForStorage/);
  assert.match(filesService, /sanitizeForStorage\({/);
  assert.match(filesService, /auditContext: input\.auditContext/);

  const filesController = fs.readFileSync(
    path.join(projectRoot, 'packages', 'files', 'src', 'files.controller.ts'),
    'utf8',
  );
  assert.match(filesController, /@Req\(\) req: any/);
  assert.match(filesController, /requestId:/);

  const filesTypes = fs.readFileSync(path.join(projectRoot, 'packages', 'files', 'src', 'files.types.ts'), 'utf8');
  assert.match(filesTypes, /auditContext\?: \{/);

  const filesImageService = fs.readFileSync(
    path.join(projectRoot, 'packages', 'files-image', 'src', 'files-image.service.ts'),
    'utf8',
  );
  assert.match(filesImageService, /loadFileTypeModule/);
  assert.match(filesImageService, /new Function\('specifier', 'return import\(specifier\)'\)/);

  const apiDockerfile = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'Dockerfile'), 'utf8');
  assert.match(
    apiDockerfile,
    /COPY packages\/files-image\/package\.json packages\/files-image\/package\.json/,
  );
  assert.match(apiDockerfile, /COPY packages\/files-image packages\/files-image/);
  assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/files-image build/);
  assert.equal(
    apiDockerfile.indexOf('RUN pnpm --filter @forgeon/files-image build') <
      apiDockerfile.indexOf('RUN pnpm --filter @forgeon/files build'),
    true,
  );

  const healthController = fs.readFileSync(
    path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
    'utf8',
  );
  assert.match(healthController, /@Get\('files-image'\)/);
  assert.match(healthController, /filesImageService\.getProbeStatus/);

  const appTsx = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'App.tsx'), 'utf8');
  assert.match(appTsx, /Check files image sanitize/);
  assert.match(appTsx, /Files image probe response/);

  const apiEnv = fs.readFileSync(path.join(projectRoot, 'apps', 'api', '.env.example'), 'utf8');
  assert.match(apiEnv, /FILES_IMAGE_ENABLED=true/);
  assert.match(apiEnv, /FILES_IMAGE_STRIP_METADATA=true/);
  assert.match(apiEnv, /FILES_IMAGE_MAX_WIDTH=4096/);
  assert.match(apiEnv, /FILES_IMAGE_MAX_HEIGHT=4096/);
  assert.match(apiEnv, /FILES_IMAGE_MAX_PIXELS=16777216/);
  assert.match(apiEnv, /FILES_IMAGE_MAX_FRAMES=1/);
  assert.match(apiEnv, /FILES_IMAGE_PROCESS_TIMEOUT_MS=5000/);
  assert.match(apiEnv, /FILES_IMAGE_ALLOWED_MIME_TYPES=image\/jpeg,image\/png,image\/webp/);

  const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
  assert.match(compose, /FILES_IMAGE_ENABLED: \$\{FILES_IMAGE_ENABLED\}/);
  assert.match(compose, /FILES_IMAGE_STRIP_METADATA: \$\{FILES_IMAGE_STRIP_METADATA\}/);
  assert.match(compose, /FILES_IMAGE_MAX_WIDTH: \$\{FILES_IMAGE_MAX_WIDTH\}/);
  assert.match(compose, /FILES_IMAGE_MAX_HEIGHT: \$\{FILES_IMAGE_MAX_HEIGHT\}/);
  assert.match(compose, /FILES_IMAGE_MAX_PIXELS: \$\{FILES_IMAGE_MAX_PIXELS\}/);
  assert.match(compose, /FILES_IMAGE_MAX_FRAMES: \$\{FILES_IMAGE_MAX_FRAMES\}/);
  assert.match(compose, /FILES_IMAGE_PROCESS_TIMEOUT_MS: \$\{FILES_IMAGE_PROCESS_TIMEOUT_MS\}/);

  const filesImagePackage = fs.readFileSync(
    path.join(projectRoot, 'packages', 'files-image', 'package.json'),
    'utf8',
  );
  assert.match(filesImagePackage, /"sharp":/);
  assert.match(filesImagePackage, /"file-type":/);

  const rootPackage = fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8');
  assert.match(rootPackage, /"onlyBuiltDependencies"/);
  assert.match(rootPackage, /"sharp"/);

  const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
  assert.match(readme, /## Files Image Module/);
  assert.match(readme, /metadata is stripped before storage/i);
}

function assertJwtAuthWiring(projectRoot, withPrismaStore) {
  const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
  assert.match(apiPackage, /@forgeon\/auth-api/);
  assert.match(apiPackage, /@forgeon\/auth-contracts/);
  assert.match(apiPackage, /pnpm --filter @forgeon\/auth-contracts build/);
  assert.match(apiPackage, /pnpm --filter @forgeon\/auth-api build/);

  const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
  assert.match(appModule, /authConfig/);
  assert.match(appModule, /authEnvSchema/);
  assert.match(appModule, /ForgeonAuthModule\.register\(/);
  if (withPrismaStore) {
    assert.match(appModule, /AUTH_REFRESH_TOKEN_STORE/);
    assert.match(appModule, /PrismaAuthRefreshTokenStore/);
  } else {
    assert.doesNotMatch(appModule, /PrismaAuthRefreshTokenStore/);
  }

  const healthController = fs.readFileSync(
    path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
    'utf8',
  );
  assert.match(healthController, /@Get\('auth'\)/);
  assert.match(healthController, /authService\.getProbeStatus/);
  assert.doesNotMatch(healthController, /,\s*,/);

  const appTsx = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'App.tsx'), 'utf8');
  assert.match(appTsx, /Check JWT auth probe/);
  assert.match(appTsx, /Auth probe response/);

  const apiDockerfile = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'Dockerfile'), 'utf8');
  assert.match(
    apiDockerfile,
    /COPY packages\/auth-contracts\/package\.json packages\/auth-contracts\/package\.json/,
  );
  assert.match(apiDockerfile, /COPY packages\/auth-api\/package\.json packages\/auth-api\/package\.json/);
  assert.match(apiDockerfile, /COPY packages\/auth-contracts packages\/auth-contracts/);
  assert.match(apiDockerfile, /COPY packages\/auth-api packages\/auth-api/);
  assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/auth-contracts build/);
  assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/auth-api build/);

  const apiEnv = fs.readFileSync(path.join(projectRoot, 'apps', 'api', '.env.example'), 'utf8');
  assert.match(apiEnv, /JWT_ACCESS_SECRET=/);
  assert.match(apiEnv, /JWT_REFRESH_SECRET=/);
  assert.match(apiEnv, /AUTH_DEMO_EMAIL=/);
  assert.match(apiEnv, /AUTH_DEMO_PASSWORD=/);

  const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
  assert.match(compose, /JWT_ACCESS_SECRET: \$\{JWT_ACCESS_SECRET\}/);
  assert.match(compose, /JWT_REFRESH_SECRET: \$\{JWT_REFRESH_SECRET\}/);

  const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
  assert.match(readme, /## JWT Auth Module/);

  const authServiceSource = fs.readFileSync(
    path.join(projectRoot, 'packages', 'auth-api', 'src', 'auth.service.ts'),
    'utf8',
  );
  assert.match(authServiceSource, /import type \{/);
  assert.doesNotMatch(authServiceSource, /import\s*\{\s*AUTH_ERROR_CODES/);
}

function stripDbPrismaArtifacts(projectRoot) {
  const dbPackageDir = path.join(projectRoot, 'packages', 'db-prisma');
  if (fs.existsSync(dbPackageDir)) {
    fs.rmSync(dbPackageDir, { recursive: true, force: true });
  }

  const prismaDir = path.join(projectRoot, 'apps', 'api', 'prisma');
  if (fs.existsSync(prismaDir)) {
    fs.rmSync(prismaDir, { recursive: true, force: true });
  }

  const apiPackagePath = path.join(projectRoot, 'apps', 'api', 'package.json');
  const apiPackage = JSON.parse(fs.readFileSync(apiPackagePath, 'utf8'));
  if (apiPackage.dependencies) {
    delete apiPackage.dependencies['@forgeon/db-prisma'];
    delete apiPackage.dependencies['@prisma/client'];
  }
  if (apiPackage.devDependencies) {
    delete apiPackage.devDependencies.prisma;
  }
  if (apiPackage.scripts) {
    for (const key of Object.keys(apiPackage.scripts)) {
      if (key.startsWith('prisma:')) {
        delete apiPackage.scripts[key];
      }
    }
    if (typeof apiPackage.scripts.predev === 'string') {
      apiPackage.scripts.predev = apiPackage.scripts.predev
        .replace('pnpm --filter @forgeon/db-prisma build && ', '')
        .replace(' && pnpm --filter @forgeon/db-prisma build', '')
        .replace('pnpm --filter @forgeon/db-prisma build', '')
        .trim();
      if (apiPackage.scripts.predev.length === 0) {
        delete apiPackage.scripts.predev;
      }
    }
  }
  delete apiPackage.prisma;
  fs.writeFileSync(apiPackagePath, `${JSON.stringify(apiPackage, null, 2)}\n`, 'utf8');

  const rootPackagePath = path.join(projectRoot, 'package.json');
  const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
  if (rootPackage.scripts && typeof rootPackage.scripts.postinstall === 'string') {
    rootPackage.scripts.postinstall = rootPackage.scripts.postinstall
      .replace(/\s*&&\s*pnpm --filter @forgeon\/api prisma:generate/g, '')
      .replace(/pnpm --filter @forgeon\/api prisma:generate\s*&&\s*/g, '')
      .trim();
    if (rootPackage.scripts.postinstall.length === 0) {
      delete rootPackage.scripts.postinstall;
    }
  }
  fs.writeFileSync(rootPackagePath, `${JSON.stringify(rootPackage, null, 2)}\n`, 'utf8');

  const appModulePath = path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts');
  let appModule = fs.readFileSync(appModulePath, 'utf8');
  appModule = appModule
    .replace(/^import \{ dbPrismaConfig, dbPrismaEnvSchema, DbPrismaModule \} from '@forgeon\/db-prisma';\r?\n/m, '')
    .replace(/,\s*dbPrismaConfig/g, '')
    .replace(/dbPrismaConfig,\s*/g, '')
    .replace(/,\s*dbPrismaEnvSchema/g, '')
    .replace(/dbPrismaEnvSchema,\s*/g, '')
    .replace(/^\s*DbPrismaModule,\r?\n/gm, '');
  fs.writeFileSync(appModulePath, appModule, 'utf8');

  const healthControllerPath = path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts');
  let healthController = fs.readFileSync(healthControllerPath, 'utf8');
  healthController = healthController
    .replace(/^import \{ PrismaService \} from '@forgeon\/db-prisma';\r?\n/m, '')
    .replace(/\s*private readonly prisma: PrismaService,\r?\n/g, '\n')
    .replace(
      /\s*@Post\('db'\)\s*async getDbProbe\(\)\s*\{[\s\S]*?\n\s*\}\r?\n/g,
      '\n',
    );
  fs.writeFileSync(healthControllerPath, healthController, 'utf8');

  const apiDockerfilePath = path.join(projectRoot, 'apps', 'api', 'Dockerfile');
  let apiDockerfile = fs.readFileSync(apiDockerfilePath, 'utf8');
  apiDockerfile = apiDockerfile
    .replace(/^COPY apps\/api\/prisma apps\/api\/prisma\r?\n/gm, '')
    .replace(/^COPY packages\/db-prisma\/package\.json packages\/db-prisma\/package\.json\r?\n/gm, '')
    .replace(/^COPY packages\/db-prisma packages\/db-prisma\r?\n/gm, '')
    .replace(/^RUN pnpm --filter @forgeon\/db-prisma build\r?\n/gm, '')
    .replace(/^RUN pnpm --filter @forgeon\/api prisma:generate\r?\n/gm, '');
  fs.writeFileSync(apiDockerfilePath, apiDockerfile, 'utf8');

  const composePath = path.join(projectRoot, 'infra', 'docker', 'compose.yml');
  let compose = fs.readFileSync(composePath, 'utf8');
  compose = compose.replace(/^\s+DATABASE_URL:.*\r?\n/gm, '');
  fs.writeFileSync(composePath, compose, 'utf8');

  const apiEnvExamplePath = path.join(projectRoot, 'apps', 'api', '.env.example');
  let apiEnv = fs.readFileSync(apiEnvExamplePath, 'utf8');
  apiEnv = apiEnv.replace(/^DATABASE_URL=.*\r?\n/gm, '');
  fs.writeFileSync(apiEnvExamplePath, apiEnv, 'utf8');

  const dockerEnvExamplePath = path.join(projectRoot, 'infra', 'docker', '.env.example');
  let dockerEnv = fs.readFileSync(dockerEnvExamplePath, 'utf8');
  dockerEnv = dockerEnv.replace(/^DATABASE_URL=.*\r?\n/gm, '');
  fs.writeFileSync(dockerEnvExamplePath, dockerEnv, 'utf8');
}

describe('addModule', () => {
  const modulesDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(modulesDir, '..', '..');

  it('applies queue module on top of scaffold without db and i18n', () => {
    const targetRoot = mkTmp('forgeon-module-queue-');
    const projectRoot = path.join(targetRoot, 'demo-queue');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-queue',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: false,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      const result = addModule({
        moduleId: 'queue',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assert.match(result.message, /applied/);
      assert.equal(fs.existsSync(result.docsPath), true);
      assert.match(result.docsPath, /modules[\\/].+[\\/]README\.md$/);
      assert.equal(fs.existsSync(path.join(projectRoot, 'modules', 'README.md')), true);

      assertQueueWiring(projectRoot);

      const note = fs.readFileSync(result.docsPath, 'utf8');
      assert.match(note, /Queue Worker/);
      assert.match(note, /Status: implemented/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('throws for unknown module id', () => {
    const targetRoot = mkTmp('forgeon-module-unknown-');
    try {
      createMinimalForgeonProject(targetRoot);
      assert.throws(
        () =>
          addModule({
            moduleId: 'unknown-module',
            targetRoot,
            packageRoot,
          }),
        /Unknown module/,
      );
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies i18n module on top of scaffold without i18n', () => {
    const targetRoot = mkTmp('forgeon-module-i18n-');
    const projectRoot = path.join(targetRoot, 'demo-i18n');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-i18n',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      assert.equal(fs.existsSync(path.join(projectRoot, 'docs')), false);

      const result = addModule({
        moduleId: 'i18n',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assert.match(result.message, /applied/);
      assert.equal(
        fs.existsSync(path.join(projectRoot, 'packages', 'i18n-contracts', 'package.json')),
        true,
      );
      assert.equal(
        fs.existsSync(path.join(projectRoot, 'packages', 'i18n-web', 'package.json')),
        true,
      );
      assert.equal(fs.existsSync(path.join(projectRoot, 'tsconfig.base.node.json')), true);
      assert.equal(fs.existsSync(path.join(projectRoot, 'tsconfig.base.esm.json')), true);

      const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
      assert.match(apiPackage, /@forgeon\/db-prisma/);
      assert.match(apiPackage, /@forgeon\/i18n/);
      assert.match(apiPackage, /@forgeon\/i18n-contracts/);

      const apiTsconfig = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'tsconfig.json'), 'utf8');
      assert.match(apiTsconfig, /tsconfig\.base\.node\.json/);

      const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
      assert.match(compose, /I18N_DEFAULT_LANG/);
      assert.doesNotMatch(compose, /I18N_ENABLED/);

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      assert.match(appModule, /coreConfig/);
      assert.match(appModule, /dbPrismaConfig/);
      assert.match(appModule, /dbPrismaEnvSchema/);
      assert.match(appModule, /createEnvValidator/);
      assert.match(appModule, /coreEnvSchema/);
      assert.match(appModule, /i18nConfig/);
      assert.match(appModule, /i18nEnvSchema/);
      assert.match(appModule, /CoreConfigModule/);
      assert.match(appModule, /CoreErrorsModule/);
      assert.match(appModule, /DbPrismaModule/);

      const mainTs = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'main.ts'), 'utf8');
      assert.match(mainTs, /CoreExceptionFilter/);
      assert.match(mainTs, /createValidationPipe/);
      assert.doesNotMatch(mainTs, /new ValidationPipe\(/);

      const forgeonI18nModule = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n', 'src', 'forgeon-i18n.module.ts'),
        'utf8',
      );
      assert.match(forgeonI18nModule, /const resolvers = \[/);
      assert.match(forgeonI18nModule, /I18nModule\.forRootAsync\([\s\S]*resolvers,/);
      assert.doesNotMatch(
        forgeonI18nModule,
        /exports:\s*\[I18nModule,\s*I18nConfigModule,\s*I18nConfigService\]/,
      );

      const appTsx = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'App.tsx'), 'utf8');
      assert.match(appTsx, /@forgeon\/i18n-web/);
      assert.match(appTsx, /react-i18next/);
      assert.match(appTsx, /ui:labels\.language/);

      const i18nWebPackage = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n-web', 'package.json'),
        'utf8',
      );
      assert.match(i18nWebPackage, /"type": "module"/);

      const i18nContractsPackage = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n-contracts', 'package.json'),
        'utf8',
      );
      assert.match(i18nContractsPackage, /"type": "module"/);

      const i18nWebTsconfig = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n-web', 'tsconfig.json'),
        'utf8',
      );
      assert.match(i18nWebTsconfig, /tsconfig\.base\.esm\.json/);

      const i18nContractsTsconfig = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n-contracts', 'tsconfig.json'),
        'utf8',
      );
      assert.match(i18nContractsTsconfig, /tsconfig\.base\.esm\.json/);

      const i18nWebSource = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n-web', 'src', 'index.ts'),
        'utf8',
      );
      assert.match(i18nWebSource, /@forgeon\/i18n-contracts/);
      assert.doesNotMatch(i18nWebSource, /I18N_DEFAULT_LANG/);

      const i18nContractsIndex = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n-contracts', 'src', 'index.ts'),
        'utf8',
      );
      assert.match(i18nContractsIndex, /from '\.\/generated'/);
      assert.doesNotMatch(i18nContractsIndex, /I18N_DEFAULT_LANG/);
      assert.doesNotMatch(i18nContractsIndex, /I18N_FALLBACK_LANG/);

      const enCommon = JSON.parse(
        fs.readFileSync(path.join(projectRoot, 'resources', 'i18n', 'en', 'common.json'), 'utf8'),
      );
      assert.equal(enCommon.actions.ok, 'OK');
      assert.equal(enCommon.nav.next, 'Next');

      const enErrors = JSON.parse(
        fs.readFileSync(path.join(projectRoot, 'resources', 'i18n', 'en', 'errors.json'), 'utf8'),
      );
      assert.equal(enErrors.http.NOT_FOUND, 'Resource not found');
      assert.equal(enErrors.validation.VALIDATION_ERROR, 'Validation error');

      const webPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'package.json'), 'utf8');
      assert.match(webPackage, /"i18next":/);
      assert.match(webPackage, /"react-i18next":/);

      const mainTsx = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'main.tsx'), 'utf8');
      assert.match(mainTsx, /import '\.\/i18n';/);

      const i18nTs = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'i18n.ts'), 'utf8');
      assert.match(i18nTs, /initReactI18next/);
      assert.match(i18nTs, /\.\.\/\.\.\/\.\.\/resources\/i18n\/en\/common\.json/);
      assert.match(i18nTs, /\.\.\/\.\.\/\.\.\/resources\/i18n\/en\/ui\.json/);
      assert.doesNotMatch(i18nTs, /I18N_DEFAULT_LANG/);

      const rootPackage = fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8');
      assert.match(rootPackage, /"forgeon:sync-integrations"/);
      assert.match(rootPackage, /"i18n:sync"/);
      assert.match(rootPackage, /"i18n:check"/);
      assert.match(rootPackage, /"i18n:types"/);
      assert.match(rootPackage, /"i18n:add"/);

      const rootReadme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
      assert.match(rootReadme, /## I18n Module/);
      assert.match(rootReadme, /installs independently/i);
      assert.match(rootReadme, /multi-package split/i);
      assert.match(rootReadme, /pnpm i18n:sync/);
      assert.match(rootReadme, /pnpm i18n:add <locale>/);

      const i18nAddScriptPath = path.join(projectRoot, 'scripts', 'i18n-add.mjs');
      assert.equal(fs.existsSync(i18nAddScriptPath), true);
      const syncScriptPath = path.join(projectRoot, 'scripts', 'forgeon-sync-integrations.mjs');
      assert.equal(fs.existsSync(syncScriptPath), true);

      const caddyDockerfile = fs.readFileSync(
        path.join(projectRoot, 'infra', 'docker', 'caddy.Dockerfile'),
        'utf8',
      );
      assert.match(caddyDockerfile, /COPY tsconfig\.base\.json \.\//);
      assert.match(caddyDockerfile, /COPY tsconfig\.base\.node\.json \.\//);
      assert.match(caddyDockerfile, /COPY tsconfig\.base\.esm\.json \.\//);
      assert.match(
        caddyDockerfile,
        /COPY packages\/i18n-contracts\/package\.json packages\/i18n-contracts\/package\.json/,
      );
      assert.match(
        caddyDockerfile,
        /COPY packages\/i18n-web\/package\.json packages\/i18n-web\/package\.json/,
      );
      assert.match(caddyDockerfile, /COPY resources resources/);

      const apiDockerfile = fs.readFileSync(
        path.join(projectRoot, 'apps', 'api', 'Dockerfile'),
        'utf8',
      );
      assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/core build/);
      assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/db-prisma build/);
      assert.match(apiDockerfile, /COPY packages\/db-prisma\/package\.json packages\/db-prisma\/package\.json/);

      const moduleDoc = fs.readFileSync(result.docsPath, 'utf8');
      assert.match(moduleDoc, /I18n/);
      assert.match(moduleDoc, /installs independently/i);
      assert.match(moduleDoc, /helper commands are part of the module surface/i);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies logger module on top of scaffold without i18n', () => {
    const targetRoot = mkTmp('forgeon-module-logger-');
    const projectRoot = path.join(targetRoot, 'demo-logger');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-logger',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      const result = addModule({
        moduleId: 'logger',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assert.match(result.message, /applied/);
      assert.equal(
        fs.existsSync(path.join(projectRoot, 'packages', 'logger', 'package.json')),
        true,
      );

      const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
      assert.match(apiPackage, /@forgeon\/logger/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/logger build/);

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      assert.match(appModule, /@forgeon\/logger/);
      assert.match(appModule, /loggerConfig/);
      assert.match(appModule, /loggerEnvSchema/);
      assert.match(appModule, /ForgeonLoggerModule/);

      const mainTs = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'main.ts'), 'utf8');
      assert.match(mainTs, /ForgeonLoggerService/);
      assert.match(mainTs, /bufferLogs: true/);
      assert.match(mainTs, /app\.useLogger\(app\.get\(ForgeonLoggerService\)\);/);
      assert.doesNotMatch(mainTs, /useGlobalInterceptors/);

      const apiDockerfile = fs.readFileSync(
        path.join(projectRoot, 'apps', 'api', 'Dockerfile'),
        'utf8',
      );
      assert.match(apiDockerfile, /COPY packages\/logger\/package\.json packages\/logger\/package\.json/);
      assert.match(apiDockerfile, /COPY packages\/logger packages\/logger/);
      assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/logger build/);

      const loggerTsconfig = fs.readFileSync(
        path.join(projectRoot, 'packages', 'logger', 'tsconfig.json'),
        'utf8',
      );
      assert.match(loggerTsconfig, /"extends": "\.\.\/\.\.\/tsconfig\.base\.node\.json"/);

      const loggerModule = fs.readFileSync(
        path.join(projectRoot, 'packages', 'logger', 'src', 'forgeon-logger.module.ts'),
        'utf8',
      );
      assert.match(loggerModule, /ForgeonHttpLoggingMiddleware/);
      assert.match(loggerModule, /consumer\.apply\(RequestIdMiddleware, ForgeonHttpLoggingMiddleware\)\.forRoutes\('\*'\);/);

      const apiEnv = fs.readFileSync(path.join(projectRoot, 'apps', 'api', '.env.example'), 'utf8');
      assert.match(apiEnv, /LOGGER_LEVEL=log/);
      assert.match(apiEnv, /LOGGER_HTTP_ENABLED=true/);
      assert.match(apiEnv, /LOGGER_REQUEST_ID_HEADER=x-request-id/);

      const healthController = fs.readFileSync(
        path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
        'utf8',
      );
      assert.doesNotMatch(healthController, /logger/i);

      const appTsx = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'App.tsx'), 'utf8');
      assert.doesNotMatch(appTsx, /Check logger/i);

      const dockerEnv = fs.readFileSync(
        path.join(projectRoot, 'infra', 'docker', '.env.example'),
        'utf8',
      );
      assert.match(dockerEnv, /LOGGER_LEVEL=log/);
      assert.match(dockerEnv, /LOGGER_HTTP_ENABLED=true/);
      assert.match(dockerEnv, /LOGGER_REQUEST_ID_HEADER=x-request-id/);

      const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
      assert.match(compose, /LOGGER_LEVEL: \$\{LOGGER_LEVEL\}/);
      assert.match(compose, /LOGGER_HTTP_ENABLED: \$\{LOGGER_HTTP_ENABLED\}/);
      assert.match(compose, /LOGGER_REQUEST_ID_HEADER: \$\{LOGGER_REQUEST_ID_HEADER\}/);

      const rootReadme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
      assert.match(rootReadme, /## Logger Module/);
      assert.match(rootReadme, /installs independently/i);
      assert.match(rootReadme, /does not add a dedicated API\/web probe/i);
      assert.match(rootReadme, /LOGGER_LEVEL=log/);
      assert.match(rootReadme, /stdout\/stderr/i);
      assert.match(rootReadme, /docker compose logs api/);

      const moduleDoc = fs.readFileSync(result.docsPath, 'utf8');
      assert.match(moduleDoc, /Logger/);
      assert.match(moduleDoc, /Status: implemented/);
      assert.match(moduleDoc, /no dedicated probe is added by design/i);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies rate-limit module on top of scaffold without i18n', () => {
    const targetRoot = mkTmp('forgeon-module-rate-limit-');
    const projectRoot = path.join(targetRoot, 'demo-rate-limit');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-rate-limit',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: false,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      const result = addModule({
        moduleId: 'rate-limit',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assertRateLimitWiring(projectRoot);

      const moduleDoc = fs.readFileSync(result.docsPath, 'utf8');
      assert.match(moduleDoc, /## Idea \/ Why/);
      assert.match(moduleDoc, /## Configuration/);
      assert.match(moduleDoc, /installs independently/i);
      assert.match(moduleDoc, /No follow-up integration sync is required/i);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies rbac module on top of scaffold without i18n', () => {
    const targetRoot = mkTmp('forgeon-module-rbac-');
    const projectRoot = path.join(targetRoot, 'demo-rbac');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-rbac',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: false,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      const result = addModule({
        moduleId: 'rbac',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assertRbacWiring(projectRoot);

      const moduleDoc = fs.readFileSync(result.docsPath, 'utf8');
      assert.match(moduleDoc, /## Idea \/ Why/);
      assert.match(moduleDoc, /## How It Works/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies files-local then files foundation modules without breaking api wiring', () => {
    const targetRoot = mkTmp('forgeon-module-files-local-');
    const projectRoot = path.join(targetRoot, 'demo-files-local');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-files-local',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      const localResult = addModule({
        moduleId: 'files-local',
        targetRoot: projectRoot,
        packageRoot,
      });
      assert.equal(localResult.applied, true);
      assertFilesLocalWiring(projectRoot);

      const filesResult = addModule({
        moduleId: 'files',
        targetRoot: projectRoot,
        packageRoot,
      });
      assert.equal(filesResult.applied, true);
      assertFilesWiring(projectRoot);

      const moduleDoc = fs.readFileSync(filesResult.docsPath, 'utf8');
      assert.match(moduleDoc, /requires `db-adapter`/i);
      assert.match(moduleDoc, /requires `files-storage-adapter`/i);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies files-s3 foundation module with env and docker wiring', () => {
    const targetRoot = mkTmp('forgeon-module-files-s3-');
    const projectRoot = path.join(targetRoot, 'demo-files-s3');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-files-s3',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      const result = addModule({
        moduleId: 'files-s3',
        targetRoot: projectRoot,
        packageRoot,
      });
      assert.equal(result.applied, true);
      assertFilesS3Wiring(projectRoot);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies files-s3 then files and keeps s3 driver default without requiring files-local', () => {
    const targetRoot = mkTmp('forgeon-module-files-s3-runtime-');
    const projectRoot = path.join(targetRoot, 'demo-files-s3-runtime');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-files-s3-runtime',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      addModule({
        moduleId: 'files-s3',
        targetRoot: projectRoot,
        packageRoot,
      });
      addModule({
        moduleId: 'files',
        targetRoot: projectRoot,
        packageRoot,
      });

      const apiEnv = fs.readFileSync(path.join(projectRoot, 'apps', 'api', '.env.example'), 'utf8');
      assert.match(apiEnv, /FILES_STORAGE_DRIVER=s3/);

      const filesService = fs.readFileSync(
        path.join(projectRoot, 'packages', 'files', 'src', 'files.service.ts'),
        'utf8',
      );
      assert.match(filesService, /storeS3/);
      assert.match(filesService, /openS3/);
      assert.match(filesService, /deleteS3/);
      assert.match(filesService, /@aws-sdk\/client-s3/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies files-access after files and wires file route checks and probe UI', () => {
    const targetRoot = mkTmp('forgeon-module-files-access-');
    const projectRoot = path.join(targetRoot, 'demo-files-access');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-files-access',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      addModule({
        moduleId: 'files-local',
        targetRoot: projectRoot,
        packageRoot,
      });
      addModule({
        moduleId: 'files',
        targetRoot: projectRoot,
        packageRoot,
      });
      const result = addModule({
        moduleId: 'files-access',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assertFilesAccessWiring(projectRoot);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies files-quotas after files and wires upload quota checks and probe UI', () => {
    const targetRoot = mkTmp('forgeon-module-files-quotas-');
    const projectRoot = path.join(targetRoot, 'demo-files-quotas');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-files-quotas',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      addModule({
        moduleId: 'files-local',
        targetRoot: projectRoot,
        packageRoot,
      });
      addModule({
        moduleId: 'files',
        targetRoot: projectRoot,
        packageRoot,
      });
      const result = addModule({
        moduleId: 'files-quotas',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assertFilesQuotasWiring(projectRoot);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies files-image after files and wires sanitize pipeline with default metadata stripping', () => {
    const targetRoot = mkTmp('forgeon-module-files-image-');
    const projectRoot = path.join(targetRoot, 'demo-files-image');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-files-image',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      addModule({
        moduleId: 'files-local',
        targetRoot: projectRoot,
        packageRoot,
      });
      addModule({
        moduleId: 'files',
        targetRoot: projectRoot,
        packageRoot,
      });
      const result = addModule({
        moduleId: 'files-image',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assertFilesImageWiring(projectRoot);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies full files stack in mixed order and keeps runtime probes consistent', () => {
    const targetRoot = mkTmp('forgeon-module-files-stack-smoke-');
    const projectRoot = path.join(targetRoot, 'demo-files-stack-smoke');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-files-stack-smoke',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      addModule({
        moduleId: 'files-s3',
        targetRoot: projectRoot,
        packageRoot,
      });
      addModule({
        moduleId: 'files',
        targetRoot: projectRoot,
        packageRoot,
      });
      addModule({
        moduleId: 'files-image',
        targetRoot: projectRoot,
        packageRoot,
      });
      addModule({
        moduleId: 'files-access',
        targetRoot: projectRoot,
        packageRoot,
      });
      addModule({
        moduleId: 'files-quotas',
        targetRoot: projectRoot,
        packageRoot,
      });

      assertFilesS3Wiring(projectRoot);
      assertFilesWiring(projectRoot, 's3');
      assertFilesImageWiring(projectRoot);
      assertFilesAccessWiring(projectRoot);
      assertFilesQuotasWiring(projectRoot);

      const healthController = fs.readFileSync(
        path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
        'utf8',
      );
      assert.match(healthController, /@Post\('files'\)/);
      assert.match(healthController, /@Get\('files-variants'\)/);
      assert.match(healthController, /@Get\('files-image'\)/);
      assert.match(healthController, /@Get\('files-access'\)/);
      assert.match(healthController, /@Get\('files-quotas'\)/);

      const appTsx = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'App.tsx'), 'utf8');
      const filesChecks = appTsx.match(/Check files /g) ?? [];
      assert.equal(filesChecks.length, 5);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies swagger module on top of scaffold without i18n', () => {
    const targetRoot = mkTmp('forgeon-module-swagger-');
    const projectRoot = path.join(targetRoot, 'demo-swagger');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-swagger',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      const result = addModule({
        moduleId: 'swagger',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assert.match(result.message, /applied/);
      assert.equal(
        fs.existsSync(path.join(projectRoot, 'packages', 'swagger', 'package.json')),
        true,
      );

      const swaggerTsconfig = fs.readFileSync(
        path.join(projectRoot, 'packages', 'swagger', 'tsconfig.json'),
        'utf8',
      );
      assert.match(swaggerTsconfig, /"extends": "\.\.\/\.\.\/tsconfig\.base\.node\.json"/);

      const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
      assert.match(apiPackage, /@forgeon\/swagger/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/swagger build/);

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      assert.match(appModule, /@forgeon\/swagger/);
      assert.match(appModule, /swaggerConfig/);
      assert.match(appModule, /swaggerEnvSchema/);
      assert.match(appModule, /ForgeonSwaggerModule/);

      const mainTs = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'main.ts'), 'utf8');
      assert.match(mainTs, /setupSwagger/);
      assert.match(mainTs, /SwaggerConfigService/);
      assert.match(mainTs, /setupSwagger\(app,\s*swaggerConfigService\)/);

      const apiDockerfile = fs.readFileSync(
        path.join(projectRoot, 'apps', 'api', 'Dockerfile'),
        'utf8',
      );
      assert.match(apiDockerfile, /COPY packages\/swagger\/package\.json packages\/swagger\/package\.json/);
      assert.match(apiDockerfile, /COPY packages\/swagger packages\/swagger/);
      assert.match(apiDockerfile, /RUN pnpm --filter @forgeon\/swagger build/);

      const apiEnv = fs.readFileSync(path.join(projectRoot, 'apps', 'api', '.env.example'), 'utf8');
      assert.match(apiEnv, /SWAGGER_ENABLED=false/);
      assert.match(apiEnv, /SWAGGER_PATH=docs/);
      assert.match(apiEnv, /SWAGGER_TITLE="Forgeon API"/);
      assert.match(apiEnv, /SWAGGER_VERSION=1\.0\.0/);

      const dockerEnv = fs.readFileSync(
        path.join(projectRoot, 'infra', 'docker', '.env.example'),
        'utf8',
      );
      assert.match(dockerEnv, /SWAGGER_ENABLED=false/);
      assert.match(dockerEnv, /SWAGGER_PATH=docs/);
      assert.match(dockerEnv, /SWAGGER_TITLE="Forgeon API"/);
      assert.match(dockerEnv, /SWAGGER_VERSION=1\.0\.0/);

      const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
      assert.match(compose, /SWAGGER_ENABLED: \$\{SWAGGER_ENABLED\}/);
      assert.match(compose, /SWAGGER_PATH: \$\{SWAGGER_PATH\}/);
      assert.match(compose, /SWAGGER_TITLE: \$\{SWAGGER_TITLE\}/);
      assert.match(compose, /SWAGGER_VERSION: \$\{SWAGGER_VERSION\}/);

      const rootReadme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
      assert.match(rootReadme, /## Swagger \/ OpenAPI Module/);
      assert.match(rootReadme, /installs independently/i);
      assert.match(rootReadme, /decorators.*manual/i);
      assert.match(rootReadme, /SWAGGER_ENABLED=false/);
      assert.match(rootReadme, /localhost:3000\/api\/docs/);

      const moduleDoc = fs.readFileSync(result.docsPath, 'utf8');
      assert.match(moduleDoc, /Swagger \/ OpenAPI/);
      assert.match(moduleDoc, /Status: implemented/);
      assert.match(moduleDoc, /feature-specific Swagger decorators remain manual/i);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies swagger module on top of scaffold with i18n', () => {
    const targetRoot = mkTmp('forgeon-module-swagger-i18n-');
    const projectRoot = path.join(targetRoot, 'demo-swagger-i18n');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-swagger-i18n',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: true,
        proxy: 'caddy',
      });

      const result = addModule({
        moduleId: 'swagger',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      const loadMatch = appModule.match(/load: \[([^\]]+)\]/);
      assert.ok(loadMatch);
      assert.match(loadMatch[1], /coreConfig/);
      assert.match(loadMatch[1], /dbPrismaConfig/);
      assert.match(loadMatch[1], /i18nConfig/);
      assert.match(loadMatch[1], /swaggerConfig/);

      const validateMatch = appModule.match(/validate: createEnvValidator\(\[([^\]]+)\]\)/);
      assert.ok(validateMatch);
      assert.match(validateMatch[1], /coreEnvSchema/);
      assert.match(validateMatch[1], /dbPrismaEnvSchema/);
      assert.match(validateMatch[1], /i18nEnvSchema/);
      assert.match(validateMatch[1], /swaggerEnvSchema/);
      assert.match(appModule, /ForgeonSwaggerModule/);
      assert.match(appModule, /ForgeonI18nModule/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies logger after swagger without losing logger config keys', () => {
    const targetRoot = mkTmp('forgeon-module-swagger-logger-');
    const projectRoot = path.join(targetRoot, 'demo-swagger-logger');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-swagger-logger',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: true,
        proxy: 'caddy',
      });

      const swaggerResult = addModule({
        moduleId: 'swagger',
        targetRoot: projectRoot,
        packageRoot,
      });
      assert.equal(swaggerResult.applied, true);

      const loggerResult = addModule({
        moduleId: 'logger',
        targetRoot: projectRoot,
        packageRoot,
      });
      assert.equal(loggerResult.applied, true);

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      const loadMatch = appModule.match(/load: \[([^\]]+)\]/);
      assert.ok(loadMatch);
      assert.match(loadMatch[1], /coreConfig/);
      assert.match(loadMatch[1], /dbPrismaConfig/);
      assert.match(loadMatch[1], /i18nConfig/);
      assert.match(loadMatch[1], /swaggerConfig/);
      assert.match(loadMatch[1], /loggerConfig/);

      const validateMatch = appModule.match(/validate: createEnvValidator\(\[([^\]]+)\]\)/);
      assert.ok(validateMatch);
      assert.match(validateMatch[1], /coreEnvSchema/);
      assert.match(validateMatch[1], /dbPrismaEnvSchema/);
      assert.match(validateMatch[1], /i18nEnvSchema/);
      assert.match(validateMatch[1], /swaggerEnvSchema/);
      assert.match(validateMatch[1], /loggerEnvSchema/);
      assert.match(appModule, /ForgeonSwaggerModule/);
      assert.match(appModule, /ForgeonLoggerModule/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies i18n after logger without losing logger config keys', () => {
    const targetRoot = mkTmp('forgeon-module-logger-i18n-');
    const projectRoot = path.join(targetRoot, 'demo-logger-i18n');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-logger-i18n',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      addModule({
        moduleId: 'logger',
        targetRoot: projectRoot,
        packageRoot,
      });

      const i18nResult = addModule({
        moduleId: 'i18n',
        targetRoot: projectRoot,
        packageRoot,
      });
      assert.equal(i18nResult.applied, true);

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      assert.match(
        appModule,
        /load: \[coreConfig,\s*dbPrismaConfig,\s*loggerConfig,\s*i18nConfig\]/,
      );
      assert.match(
        appModule,
        /validate: createEnvValidator\(\[coreEnvSchema,\s*dbPrismaEnvSchema,\s*loggerEnvSchema,\s*i18nEnvSchema\]\)/,
      );
      assert.match(appModule, /ForgeonLoggerModule/);
      assert.match(appModule, /ForgeonI18nModule/);

      const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
      assert.match(apiPackage, /@forgeon\/logger/);
      assert.match(apiPackage, /@forgeon\/i18n/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/logger build/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/i18n build/);

      const mainTs = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'main.ts'), 'utf8');
      assert.match(mainTs, /ForgeonLoggerService/);
      assert.doesNotMatch(mainTs, /ForgeonHttpLoggingInterceptor/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies i18n after swagger without losing swagger config keys', () => {
    const targetRoot = mkTmp('forgeon-module-swagger-i18n-order-');
    const projectRoot = path.join(targetRoot, 'demo-swagger-i18n-order');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-swagger-i18n-order',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      addModule({
        moduleId: 'swagger',
        targetRoot: projectRoot,
        packageRoot,
      });

      const i18nResult = addModule({
        moduleId: 'i18n',
        targetRoot: projectRoot,
        packageRoot,
      });
      assert.equal(i18nResult.applied, true);

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      assert.match(
        appModule,
        /load: \[coreConfig,\s*dbPrismaConfig,\s*swaggerConfig,\s*i18nConfig\]/,
      );
      assert.match(
        appModule,
        /validate: createEnvValidator\(\[coreEnvSchema,\s*dbPrismaEnvSchema,\s*swaggerEnvSchema,\s*i18nEnvSchema\]\)/,
      );
      assert.match(appModule, /ForgeonSwaggerModule/);
      assert.match(appModule, /ForgeonI18nModule/);

      const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
      assert.match(apiPackage, /@forgeon\/swagger/);
      assert.match(apiPackage, /@forgeon\/i18n/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/swagger build/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/i18n build/);

      const mainTs = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'main.ts'), 'utf8');
      assert.match(mainTs, /setupSwagger/);
      assert.match(mainTs, /SwaggerConfigService/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies swagger -> logger -> i18n and keeps all module wiring', () => {
    const targetRoot = mkTmp('forgeon-module-mixed-order-');
    const projectRoot = path.join(targetRoot, 'demo-mixed-order');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-mixed-order',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      addModule({ moduleId: 'swagger', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'logger', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'i18n', targetRoot: projectRoot, packageRoot });

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      assert.match(
        appModule,
        /load: \[coreConfig,\s*dbPrismaConfig,\s*swaggerConfig,\s*loggerConfig,\s*i18nConfig\]/,
      );
      assert.match(
        appModule,
        /validate: createEnvValidator\(\[coreEnvSchema,\s*dbPrismaEnvSchema,\s*swaggerEnvSchema,\s*loggerEnvSchema,\s*i18nEnvSchema\]\)/,
      );
      assert.match(appModule, /ForgeonSwaggerModule/);
      assert.match(appModule, /ForgeonLoggerModule/);
      assert.match(appModule, /ForgeonI18nModule/);

      const mainTs = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'main.ts'), 'utf8');
      assert.match(mainTs, /setupSwagger\(app,\s*swaggerConfigService\)/);
      assert.match(mainTs, /app\.useLogger\(app\.get\(ForgeonLoggerService\)\);/);
      assert.doesNotMatch(mainTs, /useGlobalInterceptors/);

      const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
      assert.match(apiPackage, /@forgeon\/swagger/);
      assert.match(apiPackage, /@forgeon\/logger/);
      assert.match(apiPackage, /@forgeon\/i18n/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/swagger build/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/logger build/);
      assert.match(apiPackage, /pnpm --filter @forgeon\/i18n build/);

      assertDbPrismaWiring(projectRoot);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies jwt-auth with db-prisma as stateless first, then wires persistence via explicit sync', () => {
    const targetRoot = mkTmp('forgeon-module-jwt-db-');
    const projectRoot = path.join(targetRoot, 'demo-jwt-db');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-jwt-db',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: true,
        proxy: 'caddy',
      });

      const result = addModule({
        moduleId: 'jwt-auth',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assertJwtAuthWiring(projectRoot, false);

      const syncResult = syncIntegrations({ targetRoot: projectRoot, packageRoot });
      const dbPair = syncResult.summary.find((item) => item.id === 'auth-persistence');
      assert.ok(dbPair);
      assert.equal(dbPair.result.applied, true);
      assert.equal(syncResult.changedFiles.length > 0, true);

      assertJwtAuthWiring(projectRoot, true);

      const storeFile = path.join(
        projectRoot,
        'apps',
        'api',
        'src',
        'auth',
        'prisma-auth-refresh-token.store.ts',
      );
      assert.equal(fs.existsSync(storeFile), true);

      const schema = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'prisma', 'schema.prisma'), 'utf8');
      assert.match(schema, /refreshTokenHash/);

      const migrationPath = path.join(
        projectRoot,
        'apps',
        'api',
        'prisma',
        'migrations',
        '0002_auth_refresh_token_hash',
        'migration.sql',
      );
      assert.equal(fs.existsSync(migrationPath), true);

      const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
      assert.match(readme, /refresh token persistence: enabled/);
      assert.match(readme, /db-adapter/);
      assert.match(readme, /current provider: `db-prisma`/);
      assert.match(readme, /0002_auth_refresh_token_hash/);

      const moduleDoc = fs.readFileSync(result.docsPath, 'utf8');
      assert.match(moduleDoc, /Status: implemented/);
      assert.match(moduleDoc, /db-adapter/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies jwt-auth without db and keeps stateless fallback until pair sync is available', () => {
    const targetRoot = mkTmp('forgeon-module-jwt-nodb-');
    const projectRoot = path.join(targetRoot, 'demo-jwt-nodb');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-jwt-nodb',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      stripDbPrismaArtifacts(projectRoot);

      const result = addModule({
        moduleId: 'jwt-auth',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assertJwtAuthWiring(projectRoot, false);
      assert.equal(
        fs.existsSync(path.join(projectRoot, 'apps', 'api', 'src', 'auth', 'prisma-auth-refresh-token.store.ts')),
        false,
      );

      const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
      assert.match(readme, /refresh token persistence: disabled/);
      assert.match(readme, /db-adapter/);
      assert.match(readme, /create-forgeon add db-prisma/);

    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('detects and applies jwt-auth + rbac claims integration explicitly', () => {
    const targetRoot = mkTmp('forgeon-module-jwt-rbac-');
    const projectRoot = path.join(targetRoot, 'demo-jwt-rbac');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-jwt-rbac',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: false,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      addModule({
        moduleId: 'rbac',
        targetRoot: projectRoot,
        packageRoot,
      });
      addModule({
        moduleId: 'jwt-auth',
        targetRoot: projectRoot,
        packageRoot,
      });

      const scan = scanIntegrations({
        targetRoot: projectRoot,
        relatedModuleId: 'jwt-auth',
      });
      assert.equal(scan.groups.some((group) => group.id === 'auth-rbac-claims'), true);

      const syncResult = syncIntegrations({
        targetRoot: projectRoot,
        packageRoot,
        groupIds: ['auth-rbac-claims'],
      });
      const claimsPair = syncResult.summary.find((item) => item.id === 'auth-rbac-claims');
      assert.ok(claimsPair);
      assert.equal(claimsPair.result.applied, true);

      const authContracts = fs.readFileSync(
        path.join(projectRoot, 'packages', 'auth-contracts', 'src', 'index.ts'),
        'utf8',
      );
      assert.match(authContracts, /permissions\?: string\[\];/);

      const authService = fs.readFileSync(
        path.join(projectRoot, 'packages', 'auth-api', 'src', 'auth.service.ts'),
        'utf8',
      );
      assert.match(authService, /permissions: \['health\.rbac'\]/);
      assert.match(authService, /permissions: user\.permissions,/);
      assert.match(
        authService,
        /permissions: Array\.isArray\(payload\.permissions\) \? payload\.permissions : \[\],/,
      );

      const authController = fs.readFileSync(
        path.join(projectRoot, 'packages', 'auth-api', 'src', 'auth.controller.ts'),
        'utf8',
      );
      assert.match(
        authController,
        /permissions: Array\.isArray\(payload\.permissions\) \? payload\.permissions : \[\],/,
      );
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('scans auth persistence as db-adapter participant while remaining triggerable from db-prisma install order', () => {
    const targetRoot = mkTmp('forgeon-module-jwt-db-scan-');
    const projectRoot = path.join(targetRoot, 'demo-jwt-db-scan');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-jwt-db-scan',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: false,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      addModule({
        moduleId: 'jwt-auth',
        targetRoot: projectRoot,
        packageRoot,
      });
      addModule({
        moduleId: 'db-prisma',
        targetRoot: projectRoot,
        packageRoot,
      });

      const scan = scanIntegrations({
        targetRoot: projectRoot,
        relatedModuleId: 'db-prisma',
      });
      const persistenceGroup = scan.groups.find((group) => group.id === 'auth-persistence');

      assert.ok(persistenceGroup);
      assert.deepEqual(persistenceGroup.modules, ['jwt-auth', 'db-adapter']);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies logger then jwt-auth on db/i18n-disabled scaffold without breaking health controller syntax', () => {
    const targetRoot = mkTmp('forgeon-module-jwt-nodb-noi18n-');
    const projectRoot = path.join(targetRoot, 'demo-jwt-nodb-noi18n');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-jwt-nodb-noi18n',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: false,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      addModule({
        moduleId: 'logger',
        targetRoot: projectRoot,
        packageRoot,
      });
      addModule({
        moduleId: 'jwt-auth',
        targetRoot: projectRoot,
        packageRoot,
      });

      const healthController = fs.readFileSync(
        path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
        'utf8',
      );
      assert.match(healthController, /constructor\(private readonly authService: AuthService\)/);
      assert.match(healthController, /@Get\('auth'\)/);
      assert.match(healthController, /return this\.authService\.getProbeStatus\(\);/);

      const classStart = healthController.indexOf('export class HealthController {');
      const classEnd = healthController.lastIndexOf('\n}');
      const authProbe = healthController.indexOf("@Get('auth')");
      assert.equal(classStart > -1, true);
      assert.equal(classEnd > classStart, true);
      assert.equal(authProbe > classStart && authProbe < classEnd, true);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('keeps health controller valid for add sequence jwt-auth -> logger -> swagger -> i18n -> db-prisma on db/i18n-disabled scaffold', () => {
    const targetRoot = mkTmp('forgeon-module-seq-health-valid-');
    const projectRoot = path.join(targetRoot, 'demo-seq-health-valid');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-seq-health-valid',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: false,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      for (const moduleId of ['jwt-auth', 'logger', 'swagger', 'i18n', 'db-prisma']) {
        addModule({ moduleId, targetRoot: projectRoot, packageRoot });
      }

      const healthController = fs.readFileSync(
        path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
        'utf8',
      );

      const classStart = healthController.indexOf('export class HealthController {');
      const classEnd = healthController.lastIndexOf('\n}');
      assert.equal(classStart > -1, true);
      assert.equal(classEnd > classStart, true);

      const imports = [...healthController.matchAll(/^import\s.+;$/gm)];
      assert.equal(imports.length > 0, true);
      for (const importLine of imports) {
        assert.equal(importLine.index < classStart, true);
      }

      const authProbe = healthController.indexOf("@Get('auth')");
      const dbProbe = healthController.indexOf("@Post('db')");
      const translateMethod = healthController.indexOf('private translate(');
      assert.equal(authProbe > classStart && authProbe < classEnd, true);
      assert.equal(dbProbe > classStart && dbProbe < classEnd, true);
      assert.equal(translateMethod > classStart && translateMethod < classEnd, true);

      assert.match(healthController, /private readonly authService: AuthService/);
      assert.match(healthController, /private readonly i18n: I18nService/);
      assert.match(healthController, /private readonly prisma: PrismaService/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies swagger then jwt-auth without forcing swagger dependency in auth-api', () => {
    const targetRoot = mkTmp('forgeon-module-jwt-swagger-');
    const projectRoot = path.join(targetRoot, 'demo-jwt-swagger');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-jwt-swagger',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: false,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      addModule({
        moduleId: 'swagger',
        targetRoot: projectRoot,
        packageRoot,
      });
      addModule({
        moduleId: 'jwt-auth',
        targetRoot: projectRoot,
        packageRoot,
      });

      const authApiPackage = JSON.parse(
        fs.readFileSync(path.join(projectRoot, 'packages', 'auth-api', 'package.json'), 'utf8'),
      );
      assert.equal(Object.hasOwn(authApiPackage.dependencies ?? {}, '@nestjs/swagger'), false);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('keeps rate-limit wiring valid after mixed module installation order', () => {
    const targetRoot = mkTmp('forgeon-module-rate-limit-order-');
    const projectRoot = path.join(targetRoot, 'demo-rate-limit-order');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-rate-limit-order',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: false,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      for (const moduleId of ['jwt-auth', 'logger', 'swagger', 'rate-limit', 'i18n', 'db-prisma']) {
        addModule({ moduleId, targetRoot: projectRoot, packageRoot });
      }

      assertRateLimitWiring(projectRoot);

      const healthController = fs.readFileSync(
        path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
        'utf8',
      );
      const classStart = healthController.indexOf('export class HealthController {');
      const classEnd = healthController.lastIndexOf('\n}');
      const rateLimitProbe = healthController.indexOf("@Get('rate-limit')");
      assert.equal(rateLimitProbe > classStart && rateLimitProbe < classEnd, true);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('keeps rbac wiring valid after mixed module installation order', () => {
    const targetRoot = mkTmp('forgeon-module-rbac-order-');
    const projectRoot = path.join(targetRoot, 'demo-rbac-order');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-rbac-order',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: false,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      for (const moduleId of ['jwt-auth', 'logger', 'rate-limit', 'rbac', 'swagger', 'i18n', 'db-prisma']) {
        addModule({ moduleId, targetRoot: projectRoot, packageRoot });
      }

      assertRbacWiring(projectRoot);

      const healthController = fs.readFileSync(
        path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'),
        'utf8',
      );
      const classStart = healthController.indexOf('export class HealthController {');
      const classEnd = healthController.lastIndexOf('\n}');
      const rbacProbe = healthController.indexOf("@Get('rbac')");
      assert.equal(rbacProbe > classStart && rbacProbe < classEnd, true);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('keeps db-prisma wiring across module installation orders', () => {
    const sequences = [
      ['logger', 'swagger', 'i18n'],
      ['swagger', 'i18n', 'logger'],
      ['i18n', 'logger', 'swagger'],
    ];

    for (const sequence of sequences) {
      const targetRoot = mkTmp(`forgeon-module-db-order-${sequence.join('-')}-`);
      const projectRoot = path.join(targetRoot, `demo-db-${sequence.join('-')}`);
      const templateRoot = path.join(packageRoot, 'templates', 'base');

      try {
        scaffoldProject({
          templateRoot,
          packageRoot,
          targetRoot: projectRoot,
          projectName: `demo-db-${sequence.join('-')}`,
          frontend: 'react',
          db: 'prisma',
        dbPrismaEnabled: true,
          i18nEnabled: false,
          proxy: 'caddy',
        });

        for (const moduleId of sequence) {
          addModule({ moduleId, targetRoot: projectRoot, packageRoot });
        }

        assertDbPrismaWiring(projectRoot);
      } finally {
        fs.rmSync(targetRoot, { recursive: true, force: true });
      }
    }
  });

  it('applies db-prisma as final module after other modules', () => {
    const targetRoot = mkTmp('forgeon-module-db-last-');
    const projectRoot = path.join(targetRoot, 'demo-db-last');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-db-last',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: false,
        proxy: 'caddy',
      });

      stripDbPrismaArtifacts(projectRoot);

      addModule({ moduleId: 'logger', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'swagger', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'i18n', targetRoot: projectRoot, packageRoot });
      const dbResult = addModule({ moduleId: 'db-prisma', targetRoot: projectRoot, packageRoot });
      assert.equal(dbResult.applied, true);

      assertDbPrismaWiring(projectRoot);

      const moduleDoc = fs.readFileSync(dbResult.docsPath, 'utf8');
      assert.match(moduleDoc, /db-adapter/);
      assert.match(moduleDoc, /current canonical implementation for `db-adapter`/);

      const appModule = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts'), 'utf8');
      assert.match(appModule, /ForgeonLoggerModule/);
      assert.match(appModule, /ForgeonSwaggerModule/);
      assert.match(appModule, /ForgeonI18nModule/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });
});
