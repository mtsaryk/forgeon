import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { printAddHelp } from './cli/add-help.mjs';
import { parseAddCliArgs } from './cli/add-options.mjs';
import { addModule } from './modules/executor.mjs';
import { listModulePresets } from './modules/registry.mjs';
import { printModuleAdded, runIntegrationFlow } from './integrations/flow.mjs';
import { writeJson } from './utils/fs.mjs';

function printModuleList() {
  const modules = listModulePresets();
  console.log('Available modules:');
  for (const moduleItem of modules) {
    const status = moduleItem.implemented ? 'implemented' : 'planned';
    console.log(`- ${moduleItem.id} (${status}) - ${moduleItem.description}`);
  }
}

function ensureSyncTooling({ packageRoot, targetRoot }) {
  const sourceScript = path.join(
    packageRoot,
    'templates',
    'base',
    'scripts',
    'forgeon-sync-integrations.mjs',
  );
  const targetScript = path.join(targetRoot, 'scripts', 'forgeon-sync-integrations.mjs');

  if (fs.existsSync(sourceScript) && !fs.existsSync(targetScript)) {
    fs.mkdirSync(path.dirname(targetScript), { recursive: true });
    fs.copyFileSync(sourceScript, targetScript);
  }

  const packagePath = path.join(targetRoot, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  packageJson.scripts['forgeon:sync-integrations'] = 'node scripts/forgeon-sync-integrations.mjs';

  writeJson(packagePath, packageJson);
}

export async function runAddModule(argv = process.argv.slice(2)) {
  const options = parseAddCliArgs(argv);

  if (options.help) {
    printAddHelp();
    return;
  }

  if (options.list) {
    printModuleList();
    return;
  }

  if (!options.moduleId) {
    throw new Error('Module id is required. Use `create-forgeon add --list` to see available modules.');
  }

  const srcDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(srcDir, '..');
  const targetRoot = path.resolve(process.cwd(), options.project);

  const result = addModule({
    moduleId: options.moduleId,
    targetRoot,
    packageRoot,
  });
  ensureSyncTooling({ packageRoot, targetRoot });
  printModuleAdded(result.preset.id, result.docsPath);
  await runIntegrationFlow({
    targetRoot,
    packageRoot,
    relatedModuleId: result.preset.id,
  });
}
