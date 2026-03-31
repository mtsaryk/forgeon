import fs from 'node:fs';
import path from 'node:path';
import { ensureLineAfter, ensureLineBefore } from './patch-utils.mjs';

function normalize(content) {
  return content.replace(/\r\n/g, '\n');
}

export function readPreferredFilesStorageDriver(targetRoot) {
  const envPath = path.join(targetRoot, 'apps', 'api', '.env.example');
  if (!fs.existsSync(envPath)) {
    return 'local';
  }

  const content = normalize(fs.readFileSync(envPath, 'utf8'));
  const match = content.match(/^FILES_STORAGE_DRIVER=(local|s3)$/m);
  return match?.[1] ?? 'local';
}

export function resolveFilesStorageRuntimeModule(targetRoot) {
  const hasLocal = fs.existsSync(path.join(targetRoot, 'packages', 'files-local', 'package.json'));
  const hasS3 = fs.existsSync(path.join(targetRoot, 'packages', 'files-s3', 'package.json'));
  const preferredDriver = readPreferredFilesStorageDriver(targetRoot);

  if (preferredDriver === 's3' && hasS3) {
    return 'ForgeonFilesS3StorageModule';
  }
  if (preferredDriver === 'local' && hasLocal) {
    return 'ForgeonFilesLocalStorageModule';
  }
  if (hasLocal) {
    return 'ForgeonFilesLocalStorageModule';
  }
  if (hasS3) {
    return 'ForgeonFilesS3StorageModule';
  }
  return null;
}

export function upsertFilesModuleRegistration(content, storageRuntimeModuleName = null) {
  const runtimeImports = ['ForgeonFilesDbPrismaModule'];
  if (storageRuntimeModuleName) {
    runtimeImports.push(storageRuntimeModuleName);
  }

  const moduleBlock = `    ForgeonFilesModule.register({
      imports: [${runtimeImports.join(', ')}],
    }),`;

  if (content.includes('ForgeonFilesModule.register({')) {
    return content.replace(
      / {4}ForgeonFilesModule\.register\(\{[\s\S]*? {4}\}\),/m,
      moduleBlock,
    );
  }

  if (content.includes('    ForgeonFilesModule,')) {
    return content.replace('    ForgeonFilesModule,', moduleBlock);
  }

  if (content.includes('    ForgeonI18nModule.register({')) {
    return ensureLineBefore(content, '    ForgeonI18nModule.register({', moduleBlock);
  }
  if (content.includes('    ForgeonAccountsModule.register({')) {
    return ensureLineBefore(content, '    ForgeonAccountsModule.register({', moduleBlock);
  }
  if (content.includes('    ForgeonAccountsModule.register(),')) {
    return ensureLineBefore(content, '    ForgeonAccountsModule.register(),', moduleBlock);
  }
  if (content.includes('    DbPrismaModule,')) {
    return ensureLineAfter(content, '    DbPrismaModule,', moduleBlock);
  }
  if (content.includes('    ForgeonLoggerModule,')) {
    return ensureLineAfter(content, '    ForgeonLoggerModule,', moduleBlock);
  }
  if (content.includes('    ForgeonSwaggerModule,')) {
    return ensureLineAfter(content, '    ForgeonSwaggerModule,', moduleBlock);
  }
  return ensureLineAfter(content, '    CoreErrorsModule,', moduleBlock);
}

