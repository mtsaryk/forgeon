import fs from 'node:fs';
import path from 'node:path';
import { ensureModuleExists } from './registry.mjs';
import { writeModuleDocs } from './docs.mjs';
import { applyDbPrismaModule } from './db-prisma.mjs';
import { applyI18nModule } from './i18n.mjs';
import { applyLoggerModule } from './logger.mjs';
import { applySwaggerModule } from './swagger.mjs';

function ensureForgeonLikeProject(targetRoot) {
  const requiredPaths = [
    path.join(targetRoot, 'package.json'),
    path.join(targetRoot, 'pnpm-workspace.yaml'),
    path.join(targetRoot, 'apps', 'api'),
  ];

  for (const requiredPath of requiredPaths) {
    if (!fs.existsSync(requiredPath)) {
      throw new Error(
        `Target path does not look like a Forgeon project: missing ${path.relative(targetRoot, requiredPath)}`,
      );
    }
  }
}

const MODULE_APPLIERS = {
  'db-prisma': applyDbPrismaModule,
  i18n: applyI18nModule,
  logger: applyLoggerModule,
  swagger: applySwaggerModule,
};

export function applyModulePreset({ moduleId, targetRoot, packageRoot }) {
  const applier = MODULE_APPLIERS[moduleId];
  if (!applier) {
    return false;
  }

  applier({ targetRoot, packageRoot });
  return true;
}

export function addModule({ moduleId, targetRoot, packageRoot, writeDocs = true }) {
  ensureForgeonLikeProject(targetRoot);

  const preset = ensureModuleExists(moduleId);
  const applied = applyModulePreset({ moduleId, targetRoot, packageRoot });
  const docsPath = writeDocs
    ? writeModuleDocs({
        packageRoot,
        targetRoot,
        preset,
      })
    : path.join(targetRoot, 'docs', 'AI', 'MODULES', `${preset.id}.md`);

  return {
    preset,
    docsPath,
    applied: applied || preset.implemented,
    message: applied
      ? `Module "${preset.id}" applied.`
      : `Module "${preset.id}" is planned; docs note created only.`,
  };
}
