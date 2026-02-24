import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive, writeJson } from '../utils/fs.mjs';
import { toKebabCase } from '../utils/values.mjs';
import { applyI18nDisabled, applyProxyPreset, patchDockerEnvForI18n } from '../presets/index.mjs';
import { applyModulePreset } from '../modules/executor.mjs';
import { generateDocs } from './docs.mjs';

function writeApiEnvExample(targetRoot, i18nEnabled) {
  const apiEnvExamplePath = path.join(targetRoot, 'apps', 'api', '.env.example');
  const apiEnvLines = [
    'PORT=3000',
    'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app?schema=public',
  ];

  if (i18nEnabled) {
    apiEnvLines.push('I18N_ENABLED=true');
    apiEnvLines.push('I18N_DEFAULT_LANG=en');
    apiEnvLines.push('I18N_FALLBACK_LANG=en');
  }

  fs.writeFileSync(apiEnvExamplePath, `${apiEnvLines.join('\n')}\n`, 'utf8');
}

function patchRootPackageJson(targetRoot, projectName) {
  const rootPackageJsonPath = path.join(targetRoot, 'package.json');
  const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
  rootPackageJson.name = toKebabCase(projectName);

  if (rootPackageJson.scripts) {
    delete rootPackageJson.scripts['create:forgeon'];
  }

  writeJson(rootPackageJsonPath, rootPackageJson);
}

export function scaffoldProject({
  templateRoot,
  packageRoot,
  targetRoot,
  projectName,
  frontend,
  db,
  i18nEnabled,
  proxy,
}) {
  copyRecursive(templateRoot, targetRoot);
  patchRootPackageJson(targetRoot, projectName);
  applyProxyPreset(targetRoot, proxy);

  if (i18nEnabled) {
    applyModulePreset({ moduleId: 'i18n', targetRoot, packageRoot });
  } else {
    patchDockerEnvForI18n(targetRoot, i18nEnabled);
    applyI18nDisabled(targetRoot);
  }

  writeApiEnvExample(targetRoot, i18nEnabled);
  generateDocs(targetRoot, { frontend, db, dockerEnabled: true, i18nEnabled, proxy }, packageRoot);
}
