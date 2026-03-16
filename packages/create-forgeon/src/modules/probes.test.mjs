import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addModule } from './executor.mjs';
import { scaffoldProject } from '../core/scaffold.mjs';

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function scaffoldBaseProject({ packageRoot, targetRoot, projectName }) {
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
    proxy: 'caddy',
  });
}

function readManagedProbeIds(projectRoot) {
  const probesTs = readFile(path.join(projectRoot, 'apps', 'web', 'src', 'probes.ts'));
  const match = probesTs.match(/forgeon:module-probes:start(?:\n([\s\S]*?))?\n  \/\/ forgeon:module-probes:end/);
  const block = match?.[1] ?? '';
  return [...block.matchAll(/"id": "([^"]+)"/g)].map((item) => item[1]);
}

function captureLogs(work) {
  const lines = [];
  const originalLog = console.log;
  console.log = (...args) => {
    lines.push(args.join(' '));
  };

  try {
    work();
  } finally {
    console.log = originalLog;
  }

  return lines.join('\n');
}

describe('probe wiring', () => {
  const modulesDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(modulesDir, '..', '..');

  it('skips API and web probe wiring when probes are disabled in package.json', () => {
    const tempRoot = makeTempDir('forgeon-probes-disabled-');
    const projectRoot = path.join(tempRoot, 'demo-probes-disabled');

    try {
      scaffoldBaseProject({
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-probes-disabled',
      });

      const packagePath = path.join(projectRoot, 'package.json');
      const packageJson = JSON.parse(readFile(packagePath));
      packageJson.forgeon.diagnostics.probes.enabled = false;
      writeJson(packagePath, packageJson);

      const output = captureLogs(() => {
        addModule({ moduleId: 'queue', targetRoot: projectRoot, packageRoot });
      });

      const healthController = readFile(path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'));
      assert.doesNotMatch(healthController, /@Get\('queue'\)/);
      assert.doesNotMatch(readFile(path.join(projectRoot, 'apps', 'web', 'src', 'probes.ts')), /"id": "queue"/);
      assert.match(output, /forgeon\.diagnostics\.probes\.enabled=false/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('skips probe wiring entirely when HealthController is missing', () => {
    const tempRoot = makeTempDir('forgeon-probes-no-health-');
    const projectRoot = path.join(tempRoot, 'demo-probes-no-health');

    try {
      scaffoldBaseProject({
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-probes-no-health',
      });

      fs.rmSync(path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'));

      const output = captureLogs(() => {
        addModule({ moduleId: 'queue', targetRoot: projectRoot, packageRoot });
      });

      assert.equal(
        fs.existsSync(path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts')),
        false,
      );
      assert.doesNotMatch(readFile(path.join(projectRoot, 'apps', 'web', 'src', 'probes.ts')), /"id": "queue"/);
      assert.match(output, /health\.controller\.ts is missing/);
      assert.doesNotMatch(output, /App\.tsx/);
      assert.doesNotMatch(output, /#probes/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('adds only API probes when App.tsx is missing', () => {
    const tempRoot = makeTempDir('forgeon-probes-no-app-');
    const projectRoot = path.join(tempRoot, 'demo-probes-no-app');

    try {
      scaffoldBaseProject({
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-probes-no-app',
      });

      fs.rmSync(path.join(projectRoot, 'apps', 'web', 'src', 'App.tsx'));

      const output = captureLogs(() => {
        addModule({ moduleId: 'queue', targetRoot: projectRoot, packageRoot });
      });

      const healthController = readFile(path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'));
      assert.match(healthController, /@Get\('queue'\)/);
      assert.doesNotMatch(readFile(path.join(projectRoot, 'apps', 'web', 'src', 'probes.ts')), /"id": "queue"/);
      assert.match(output, /App\.tsx is missing/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('adds only API probes when the #probes container is missing', () => {
    const tempRoot = makeTempDir('forgeon-probes-no-container-');
    const projectRoot = path.join(tempRoot, 'demo-probes-no-container');

    try {
      scaffoldBaseProject({
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-probes-no-container',
      });

      const appPath = path.join(projectRoot, 'apps', 'web', 'src', 'App.tsx');
      const appTsx = readFile(appPath).replace('id="probes"', 'id="diagnostics"');
      fs.writeFileSync(appPath, appTsx, 'utf8');

      const output = captureLogs(() => {
        addModule({ moduleId: 'rate-limit', targetRoot: projectRoot, packageRoot });
      });

      const healthController = readFile(path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'));
      assert.match(healthController, /@Get\('rate-limit'\)/);
      assert.doesNotMatch(readFile(path.join(projectRoot, 'apps', 'web', 'src', 'probes.ts')), /"id": "rate-limit"/);
      assert.match(output, /#probes container/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('keeps managed probe order stable regardless of install order', () => {
    const tempRoot = makeTempDir('forgeon-probes-order-');
    const projectRoot = path.join(tempRoot, 'demo-probes-order');

    try {
      scaffoldBaseProject({
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-probes-order',
      });

      addModule({ moduleId: 'queue', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'scheduler', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'db-prisma', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'jwt-auth', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'rate-limit', targetRoot: projectRoot, packageRoot });

      assert.deepEqual(readManagedProbeIds(projectRoot), ['db', 'auth', 'rate-limit', 'queue', 'scheduler']);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});



