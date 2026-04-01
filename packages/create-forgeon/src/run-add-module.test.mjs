import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaffoldProject } from './core/scaffold.mjs';
import { runAddModule } from './run-add-module.mjs';

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function scaffoldBaseProject({ packageRoot, targetRoot, projectName, proxy }) {
  const templateRoot = path.join(packageRoot, 'templates', 'base');
  scaffoldProject({
    templateRoot,
    packageRoot,
    targetRoot,
    projectName,
    frontend: 'react',
    db: 'prisma',
    dbPrismaEnabled: false,
    i18nEnabled: false,
    proxy,
  });
}

function stripSyncTooling(targetRoot) {
  const packagePath = path.join(targetRoot, 'package.json');
  const packageJson = JSON.parse(readFile(packagePath));
  if (packageJson.scripts) {
    delete packageJson.scripts['forgeon:sync-integrations'];
  }
  writeJson(packagePath, packageJson);

  fs.rmSync(path.join(targetRoot, 'scripts', 'forgeon-sync-integrations.mjs'), { force: true });
}

async function captureLogs(work) {
  const lines = [];
  const originalLog = console.log;
  console.log = (...args) => {
    lines.push(args.join(' '));
  };

  try {
    await work(lines);
  } finally {
    console.log = originalLog;
  }

  return lines.join('\n');
}

describe('runAddModule', () => {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(thisDir, '..');

  it('lists implemented modules without status suffixes', async () => {
    const output = await captureLogs(async () => {
      await runAddModule(['--list']);
    });

    assert.match(output, /Available modules:/);
    assert.doesNotMatch(output, /\(implemented\)/);
    assert.match(output, /- files - /);
  });

  it('installs files stack non-interactively with provider selection and restores sync tooling', async () => {
    const tempRoot = makeTempDir('forgeon-run-add-files-');
    const targetRoot = path.join(tempRoot, 'demo-run-add-files');

    try {
      scaffoldBaseProject({
        packageRoot,
        targetRoot,
        projectName: 'demo-run-add-files',
        proxy: 'nginx',
      });
      stripSyncTooling(targetRoot);

      const output = await captureLogs(async () => {
        await runAddModule([
          'files',
          '--project',
          targetRoot,
          '--with-required',
          '--provider',
          'files-storage-adapter=files-local',
        ]);
      });

      assert.equal(fs.existsSync(path.join(targetRoot, 'packages', 'db-prisma', 'package.json')), true);
      assert.equal(fs.existsSync(path.join(targetRoot, 'packages', 'files-local', 'package.json')), true);
      assert.equal(fs.existsSync(path.join(targetRoot, 'packages', 'files', 'package.json')), true);
      assert.equal(fs.existsSync(path.join(targetRoot, 'scripts', 'forgeon-sync-integrations.mjs')), true);

      const packageJson = JSON.parse(readFile(path.join(targetRoot, 'package.json')));
      assert.equal(packageJson.scripts['forgeon:sync-integrations'], 'node scripts/forgeon-sync-integrations.mjs');
      assert.equal(packageJson.scripts['add-all'], 'npx create-forgeon@latest add all --project .');

      const compose = readFile(path.join(targetRoot, 'infra', 'docker', 'compose.yml'));
      assert.match(compose, /^\s{2}nginx:\s*$/m);
      assert.doesNotMatch(compose, /^\s{2}caddy:\s*$/m);

      const apiEnv = readFile(path.join(targetRoot, 'apps', 'api', '.env.example'));
      assert.match(apiEnv, /DATABASE_URL=postgresql:\/\/postgres:postgres@localhost:5432\/app\?schema=public/);
      assert.match(apiEnv, /FILES_STORAGE_DRIVER=local/);

      const healthController = readFile(path.join(targetRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'));
      assert.match(healthController, /@Post\('files'\)/);

      assert.match(output, /Recommended companion modules are available:/);
      assert.match(output, /No integration groups found\./);
      assert.match(output, /Next: run pnpm install/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('installs all implemented modules non-interactively with the recommended provider', async () => {
    const tempRoot = makeTempDir('forgeon-run-add-all-');
    const targetRoot = path.join(tempRoot, 'demo-run-add-all');

    try {
      scaffoldBaseProject({
        packageRoot,
        targetRoot,
        projectName: 'demo-run-add-all',
        proxy: 'caddy',
      });
      stripSyncTooling(targetRoot);

      const output = await captureLogs(async () => {
        await runAddModule(['all', '--project', targetRoot]);
      });

      const expectedInstalledModules = [
        'db-prisma',
        'files-local',
        'files',
        'files-access',
        'files-quotas',
        'files-image',
        'i18n',
        'logger',
        'swagger',
        'accounts',
        'rate-limit',
        'rbac',
        'queue',
        'scheduler',
      ];

      for (const moduleId of expectedInstalledModules) {
        const packageDir =
          moduleId === 'accounts'
            ? path.join(targetRoot, 'packages', 'accounts-api')
            : path.join(targetRoot, 'packages', moduleId);
        assert.equal(fs.existsSync(path.join(packageDir, 'package.json')), true, `expected ${moduleId}`);
      }

      assert.equal(fs.existsSync(path.join(targetRoot, 'packages', 'files-s3', 'package.json')), false);

      const packageJson = JSON.parse(readFile(path.join(targetRoot, 'package.json')));
      assert.equal(packageJson.scripts['forgeon:sync-integrations'], 'node scripts/forgeon-sync-integrations.mjs');
      assert.equal(packageJson.scripts['add-all'], 'npx create-forgeon@latest add all --project .');

      const healthController = readFile(path.join(targetRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'));
      assert.match(healthController, /@Post\('files'\)/);
      assert.match(healthController, /@Get\('files-image'\)/);
      assert.match(healthController, /@Get\('queue'\)/);
      assert.match(healthController, /@Get\('scheduler'\)/);
      assert.match(healthController, /@Get\('rate-limit'\)/);

      assert.match(output, /Found 1 integration group/);
      assert.match(output, /Integration skipped\./);
      assert.match(output, /Run later with: pnpm forgeon:sync-integrations/);
      assert.match(output, /Next: run pnpm install/);
      assert.doesNotMatch(output, /Recommended companion modules are available:/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('installs scheduler with required queue on proxy=none scaffold', async () => {
    const tempRoot = makeTempDir('forgeon-run-add-scheduler-');
    const targetRoot = path.join(tempRoot, 'demo-run-add-scheduler');

    try {
      scaffoldBaseProject({
        packageRoot,
        targetRoot,
        projectName: 'demo-run-add-scheduler',
        proxy: 'none',
      });

      const output = await captureLogs(async () => {
        await runAddModule(['scheduler', '--project', targetRoot, '--with-required']);
      });

      assert.equal(fs.existsSync(path.join(targetRoot, 'packages', 'queue', 'package.json')), true);
      assert.equal(fs.existsSync(path.join(targetRoot, 'packages', 'scheduler', 'package.json')), true);

      const compose = readFile(path.join(targetRoot, 'infra', 'docker', 'compose.yml'));
      assert.match(compose, /^\s{2}redis:\s*$/m);
      assert.doesNotMatch(compose, /^\s{2}caddy:\s*$/m);
      assert.doesNotMatch(compose, /^\s{2}nginx:\s*$/m);

      const healthController = readFile(path.join(targetRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'));
      assert.match(healthController, /@Get\('queue'\)/);
      assert.match(healthController, /@Get\('scheduler'\)/);

      assert.match(output, /No integration groups found\./);
      assert.match(output, /Next: run pnpm install/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

