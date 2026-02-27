import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { printAddHelp } from './cli/add-help.mjs';
import { parseAddCliArgs } from './cli/add-options.mjs';
import { addModule } from './modules/executor.mjs';
import { listModulePresets } from './modules/registry.mjs';
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
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }

  packageJson.scripts['forgeon:sync-integrations'] = 'node scripts/forgeon-sync-integrations.mjs';
  if (!packageJson.devDependencies['ts-morph']) {
    packageJson.devDependencies['ts-morph'] = '^24.0.0';
  }

  writeJson(packagePath, packageJson);
}

function runIntegrationSync(targetRoot) {
  const scriptPath = path.join(targetRoot, 'scripts', 'forgeon-sync-integrations.mjs');
  if (!fs.existsSync(scriptPath)) {
    return;
  }

  const tsMorphPackagePath = path.join(targetRoot, 'node_modules', 'ts-morph', 'package.json');
  if (!fs.existsSync(tsMorphPackagePath)) {
    console.warn(
      '[create-forgeon add] sync-integrations skipped (dependencies are not installed yet). ' +
        'Run `pnpm install` then `pnpm forgeon:sync-integrations` inside the project.',
    );
    return;
  }

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: targetRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    console.warn(
      '[create-forgeon add] sync-integrations failed. ' +
        'Run `pnpm install` then `pnpm forgeon:sync-integrations` inside the project.',
    );
  }
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
  runIntegrationSync(targetRoot);

  console.log(result.message);
  console.log(`- module: ${result.preset.id}`);
  console.log(`- docs: ${result.docsPath}`);
}
