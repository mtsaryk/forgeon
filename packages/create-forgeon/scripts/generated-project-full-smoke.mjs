import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaffoldProject } from '../src/core/scaffold.mjs';
import { addModule } from '../src/modules/executor.mjs';
import { detectInstalledModules } from '../src/modules/dependencies.mjs';

const FULL_MODULE_SEQUENCE = [
  'db-prisma',
  'i18n',
  'logger',
  'swagger',
  'communications',
  'accounts',
  'rbac',
  'rate-limit',
  'queue',
  'scheduler',
  'files-s3',
  'files-local',
  'files',
  'files-access',
  'files-quotas',
  'files-image',
];

function parseFlag(argv, name, fallback) {
  const prefix = '--' + name + '=';
  const match = argv.find((arg) => arg.startsWith(prefix));
  if (!match) {
    return fallback;
  }

  return match.slice(prefix.length);
}

function hasFlag(argv, name) {
  return argv.includes('--' + name);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function getPnpmInvocation(args) {
  if (process.platform === 'win32') {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', 'pnpm.cmd', ...args],
    };
  }

  return {
    command: 'pnpm',
    args,
  };
}

function runCommand(command, args, { cwd, label }) {
  console.log('');
  console.log('==> ' + label);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error('Command failed (' + label + '): ' + command + ' ' + args.join(' '));
  }
}

function assertGeneratedProjectState(targetRoot) {
  const installed = detectInstalledModules(targetRoot);
  for (const moduleId of FULL_MODULE_SEQUENCE) {
    assert.equal(installed.has(moduleId), true, 'Expected installed module: ' + moduleId);
  }

  assert.equal(fs.existsSync(path.join(targetRoot, 'scripts', 'forgeon-sync-integrations.mjs')), true);
  assert.equal(
    fs.existsSync(path.join(targetRoot, 'resources', 'communications', 'email', 'communications_probe.html')),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(targetRoot, 'apps', 'api', 'prisma', 'migrations', '0002_accounts_core', 'migration.sql')),
    true,
  );

  const appModule = read(path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts'));
  const accountsApiPackage = read(path.join(targetRoot, 'packages', 'accounts-api', 'package.json'));
  const communicationsPackage = read(path.join(targetRoot, 'packages', 'communications', 'package.json'));
  const probes = read(path.join(targetRoot, 'apps', 'web', 'src', 'probes.ts'));
  const readme = read(path.join(targetRoot, 'README.md'));
  const compose = read(path.join(targetRoot, 'infra', 'docker', 'compose.yml'));

  assert.match(appModule, /communicationsConfig/);
  assert.match(appModule, /communicationsEnvSchema/);
  assert.match(appModule, /ForgeonCommunicationsModule\.register\(\)/);
  assert.match(appModule, /ForgeonAccountsModule\.register\(/);
  assert.match(accountsApiPackage, /@forgeon\/communications/);
  assert.match(communicationsPackage, /nodemailer/);
  assert.match(probes, /"id": "communications"/);
  assert.match(probes, /"buttonLabel": "Send communications probe email"/);
  assert.match(probes, /\$INPUT\.email\$/);
  assert.match(readme, /## Communications Module/);
  assert.match(readme, /CommunicationsService/);
  assert.match(readme, /## Accounts Module/);
  assert.match(compose, /^\s{2}redis:\s*$/m);
  assert.match(compose, /^\s{2}caddy:\s*$/m);
}

const argv = process.argv.slice(2);
const keep = hasFlag(argv, 'keep');
const skipDocker = hasFlag(argv, 'skip-docker');
const name = parseFlag(argv, 'name', 'forgeon-full-smoke-app');
const proxy = parseFlag(argv, 'proxy', 'caddy');

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(thisDir, '..');
const templateRoot = path.join(packageRoot, 'templates', 'base');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeon-generated-full-smoke-'));
const targetRoot = path.join(tempRoot, name);

try {
  console.log('Generating full-smoke project...');
  scaffoldProject({
    templateRoot,
    packageRoot,
    targetRoot,
    projectName: name,
    frontend: 'react',
    db: 'prisma',
    dbPrismaEnabled: false,
    i18nEnabled: false,
    proxy,
  });

  console.log('Applying all implemented modules in fixed order...');
  for (const moduleId of FULL_MODULE_SEQUENCE) {
    addModule({ moduleId, targetRoot, packageRoot });
    console.log('- applied ' + moduleId);
  }

  runCommand(process.execPath, ['scripts/forgeon-sync-integrations.mjs'], {
    cwd: targetRoot,
    label: 'generated sync integrations',
  });

  assertGeneratedProjectState(targetRoot);

  const pnpmInstall = getPnpmInvocation(['install']);
  runCommand(pnpmInstall.command, pnpmInstall.args, {
    cwd: targetRoot,
    label: 'generated pnpm install',
  });

  const pnpmBuild = getPnpmInvocation(['build']);
  runCommand(pnpmBuild.command, pnpmBuild.args, {
    cwd: targetRoot,
    label: 'generated pnpm build',
  });

  if (!skipDocker) {
    runCommand('docker', ['compose', '--env-file', 'infra/docker/.env.example', '-f', 'infra/docker/compose.yml', 'build'], {
      cwd: targetRoot,
      label: 'generated docker compose build',
    });
  }

  console.log('');
  console.log('Generated full project smoke check passed.');
  console.log('- path: ' + targetRoot);
  console.log('- proxy: ' + proxy);
  console.log('- modules: ' + FULL_MODULE_SEQUENCE.length);
  console.log('- docker: ' + (!skipDocker));
  console.log('- kept: ' + keep);
} finally {
  if (!keep) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
