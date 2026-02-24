#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const rootPackagePath = path.join(repoRoot, 'package.json');
const cliPackagePath = path.join(repoRoot, 'packages', 'create-forgeon', 'package.json');
const cliPackageDir = path.join(repoRoot, 'packages', 'create-forgeon');

const releaseType = process.argv.includes('--minor') ? 'minor' : 'patch';
const isDryRun = process.argv.includes('--dry-run');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.error) {
    throw new Error(
      `Failed to run "${command} ${args.join(' ')}": ${result.error.message}`,
    );
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function quoteCmdArg(arg) {
  if (/[\s"]/u.test(arg)) {
    return `"${arg.replace(/"/g, '\\"')}"`;
  }
  return arg;
}

function runNpm(args, options = {}) {
  if (process.platform === 'win32') {
    const npmCommandLine = `npm ${args.map(quoteCmdArg).join(' ')}`;
    run('cmd.exe', ['/d', '/s', '/c', npmCommandLine], options);
    return;
  }

  run('npm', args, options);
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function bumpPatch(version) {
  const parsed = parseSemver(version);
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

function bumpMinor(version) {
  const parsed = parseSemver(version);
  return `${parsed.major}.${parsed.minor + 1}.0`;
}

function main() {
  const rootPkg = readJson(rootPackagePath);
  const cliPkg = readJson(cliPackagePath);

  if (rootPkg.version !== cliPkg.version) {
    throw new Error(
      `Version mismatch: forgeon=${rootPkg.version}, create-forgeon=${cliPkg.version}. Align them first.`,
    );
  }

  const nextVersion = releaseType === 'minor' ? bumpMinor(rootPkg.version) : bumpPatch(rootPkg.version);

  console.log(`Release type: ${releaseType}`);
  console.log(`Current version: ${rootPkg.version}`);
  console.log(`Next version: ${nextVersion}`);
  if (isDryRun) {
    console.log('Dry run mode: no files or git/npm commands will be executed.');
    return;
  }

  rootPkg.version = nextVersion;
  cliPkg.version = nextVersion;
  writeJson(rootPackagePath, rootPkg);
  writeJson(cliPackagePath, cliPkg);

  run('git', ['add', '.']);
  run('git', ['commit', '-m', nextVersion]);
  run('git', ['tag', nextVersion]);
  run('git', ['push']);
  run('git', ['push', 'origin', nextVersion]);

  console.log('Starting npm publish for create-forgeon...');
  console.log('Manual handoff: complete npm auth/OTP prompts in this terminal if requested.');
  runNpm(['publish', '--access', 'public'], { cwd: cliPackageDir });

  console.log(`Release completed: ${nextVersion}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
