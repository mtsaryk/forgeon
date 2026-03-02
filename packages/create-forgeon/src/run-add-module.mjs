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

function toSortedObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function collectDependencyManifestState(targetRoot) {
  const state = new Map();
  if (!fs.existsSync(targetRoot)) {
    return state;
  }

  const queue = [targetRoot];
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build']);

  while (queue.length > 0) {
    const currentDir = queue.shift();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          queue.push(path.join(currentDir, entry.name));
        }
        continue;
      }

      if (!entry.isFile() || entry.name !== 'package.json') {
        continue;
      }

      const filePath = path.join(currentDir, entry.name);
      const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const snapshot = {
        name: packageJson.name ?? null,
        dependencies: toSortedObject(packageJson.dependencies),
        devDependencies: toSortedObject(packageJson.devDependencies),
        optionalDependencies: toSortedObject(packageJson.optionalDependencies),
        peerDependencies: toSortedObject(packageJson.peerDependencies),
        onlyBuiltDependencies: Array.isArray(packageJson.pnpm?.onlyBuiltDependencies)
          ? [...packageJson.pnpm.onlyBuiltDependencies].sort()
          : [],
      };

      state.set(path.relative(targetRoot, filePath), JSON.stringify(snapshot));
    }
  }

  return state;
}

function getChangedDependencyManifestPaths(beforeState, afterState) {
  const changed = [];

  for (const [filePath, nextSnapshot] of afterState.entries()) {
    if (beforeState.get(filePath) !== nextSnapshot) {
      changed.push(filePath);
    }
  }

  return changed.sort();
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

  if (fs.existsSync(sourceScript)) {
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
  const dependencyManifestStateBefore = collectDependencyManifestState(targetRoot);

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

  const dependencyManifestStateAfter = collectDependencyManifestState(targetRoot);
  const changedDependencyManifestPaths = getChangedDependencyManifestPaths(
    dependencyManifestStateBefore,
    dependencyManifestStateAfter,
  );
  if (changedDependencyManifestPaths.length > 0) {
    console.log('Next: run pnpm install');
  }
}
