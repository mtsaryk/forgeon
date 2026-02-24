import fs from 'node:fs';
import path from 'node:path';
import { ensureModuleExists } from './registry.mjs';
import { writeModuleDocs } from './docs.mjs';

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

export function addModule({ moduleId, targetRoot, packageRoot }) {
  ensureForgeonLikeProject(targetRoot);

  const preset = ensureModuleExists(moduleId);
  const docsPath = writeModuleDocs({
    packageRoot,
    targetRoot,
    preset,
  });

  return {
    preset,
    docsPath,
    applied: preset.implemented,
    message: preset.implemented
      ? `Module "${preset.id}" applied.`
      : `Module "${preset.id}" is planned; docs note created only.`,
  };
}
