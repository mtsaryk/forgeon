import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runIntegrationFlow } from './integrations/flow.mjs';
import { writeJson } from './utils/fs.mjs';

function parseScanArgs(argv) {
  const options = {
    project: '.',
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '-h' || arg === '--help') {
      options.help = true;
      continue;
    }
    if (arg.startsWith('--project=')) {
      options.project = arg.split('=')[1] || '.';
      continue;
    }
    if (arg === '--project') {
      if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
        options.project = argv[i + 1];
        i += 1;
      }
    }
  }

  return options;
}

function printScanHelp() {
  console.log(`create-forgeon scan-integrations

Usage:
  npx create-forgeon@latest scan-integrations [options]

Options:
  --project <path>   Target project path (default: current directory)
  -h, --help         Show this help
`);
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

export async function runScanIntegrations(argv = process.argv.slice(2)) {
  const options = parseScanArgs(argv);
  if (options.help) {
    printScanHelp();
    return;
  }

  const srcDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(srcDir, '..');
  const targetRoot = path.resolve(process.cwd(), options.project);

  ensureSyncTooling({ packageRoot, targetRoot });
  await runIntegrationFlow({
    targetRoot,
    packageRoot,
    relatedModuleId: null,
    scanMessage: 'Scanning for pending integrations...',
  });
}
