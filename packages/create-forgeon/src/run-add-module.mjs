import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { printAddHelp } from './cli/add-help.mjs';
import { parseAddCliArgs } from './cli/add-options.mjs';
import { promptSelect } from './cli/prompt-select.mjs';
import { addModule } from './modules/executor.mjs';
import { getPendingOptionalIntegrations, resolveModuleInstallPlan } from './modules/dependencies.mjs';
import { listModulePresets } from './modules/registry.mjs';
import {
  printModuleAdded,
  printOptionalIntegrationsWarning,
  runIntegrationFlow,
} from './integrations/flow.mjs';
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

function printInstallPlan(moduleSequence) {
  if (!Array.isArray(moduleSequence) || moduleSequence.length === 0) {
    return;
  }

  console.log('Install plan:');
  moduleSequence.forEach((moduleId, index) => {
    console.log(`${index + 1}. ${moduleId}`);
  });
}

async function confirmInstallPlan(moduleSequence, requestedModuleId) {
  if (moduleSequence.length <= 1) {
    return true;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return true;
  }

  printInstallPlan(moduleSequence);
  const picked = await promptSelect({
    message: `Apply now for "${requestedModuleId}"?`,
    defaultValue: 'cancel',
    choices: [
      { label: 'Yes, apply install plan', value: 'apply' },
      { label: 'Cancel', value: 'cancel' },
    ],
  });
  return picked === 'apply';
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
  const plan = await resolveModuleInstallPlan({
    moduleId: options.moduleId,
    targetRoot,
    withRequired: options.withRequired,
    providerSelections: options.providers,
  });

  if (plan.cancelled) {
    console.log('Installation cancelled.');
    return;
  }

  const confirmed = await confirmInstallPlan(plan.moduleSequence, options.moduleId);
  if (!confirmed) {
    console.log('Installation cancelled.');
    return;
  }

  for (const moduleId of plan.moduleSequence) {
    const currentResult = addModule({
      moduleId,
      targetRoot,
      packageRoot,
    });
    printModuleAdded(currentResult.preset.id, currentResult.docsPath);
  }

  ensureSyncTooling({ packageRoot, targetRoot });
  await runIntegrationFlow({
    targetRoot,
    packageRoot,
    relatedModuleId: options.moduleId,
  });

  const pendingOptionalIntegrations = getPendingOptionalIntegrations({
    moduleId: options.moduleId,
    targetRoot,
  });
  printOptionalIntegrationsWarning(pendingOptionalIntegrations);

  const dependencyManifestStateAfter = collectDependencyManifestState(targetRoot);
  const changedDependencyManifestPaths = getChangedDependencyManifestPaths(
    dependencyManifestStateBefore,
    dependencyManifestStateAfter,
  );
  if (changedDependencyManifestPaths.length > 0) {
    console.log('Next: run pnpm install');
  }
}
