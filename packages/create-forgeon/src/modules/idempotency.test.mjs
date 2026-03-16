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

function scaffoldBaseProject({ packageRoot, targetRoot, projectName, dbPrismaEnabled, proxy = 'caddy' }) {
  const templateRoot = path.join(packageRoot, 'templates', 'base');
  scaffoldProject({
    templateRoot,
    packageRoot,
    targetRoot,
    projectName,
    frontend: 'react',
    db: 'prisma',
    dbPrismaEnabled,
    i18nEnabled: false,
    proxy,
  });
}

function readProjectSnapshot(projectRoot) {
  const snapshot = {};
  const queue = [projectRoot];
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build']);

  while (queue.length > 0) {
    const currentDir = queue.shift();
    const entries = fs
      .readdirSync(currentDir, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const nextPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          queue.push(nextPath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      snapshot[path.relative(projectRoot, nextPath)] = readFile(nextPath);
    }
  }

  return Object.fromEntries(
    Object.entries(snapshot).sort(([left], [right]) => left.localeCompare(right)),
  );
}

describe('addModule idempotency', () => {
  const modulesDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(modulesDir, '..', '..');
  const scenarios = [
    {
      name: 'logger',
      moduleId: 'logger',
      dbPrismaEnabled: true,
      setup: [],
      verify(projectRoot) {
        assert.equal(fs.existsSync(path.join(projectRoot, 'packages', 'logger', 'package.json')), true);
        assert.match(
          readFile(path.join(projectRoot, 'apps', 'api', 'src', 'main.ts')),
          /app\.useLogger\(app\.get\(ForgeonLoggerService\)\);/,
        );
      },
    },
    {
      name: 'jwt-auth',
      moduleId: 'jwt-auth',
      dbPrismaEnabled: false,
      setup: [],
      verify(projectRoot) {
        assert.equal(fs.existsSync(path.join(projectRoot, 'packages', 'auth-api', 'package.json')), true);
        assert.match(
          readFile(path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts')),
          /@Get\('auth'\)/,
        );
        assert.doesNotMatch(
          readFile(path.join(projectRoot, 'apps', 'api', 'src', 'app.module.ts')),
          /PrismaAuthRefreshTokenStore/,
        );
      },
    },
    {
      name: 'files-local',
      moduleId: 'files-local',
      dbPrismaEnabled: true,
      setup: [],
      verify(projectRoot) {
        assert.equal(fs.existsSync(path.join(projectRoot, 'packages', 'files-local', 'package.json')), true);
        assert.match(readFile(path.join(projectRoot, 'apps', 'api', '.env.example')), /FILES_LOCAL_ROOT=storage\/uploads/);
        assert.match(readFile(path.join(projectRoot, 'infra', 'docker', 'compose.yml')), /^\s{2}files_data:\s*$/m);
      },
    },
    {
      name: 'files',
      moduleId: 'files',
      dbPrismaEnabled: true,
      setup: ['files-local'],
      verify(projectRoot) {
        assert.equal(fs.existsSync(path.join(projectRoot, 'packages', 'files', 'package.json')), true);
        assert.match(readFile(path.join(projectRoot, 'apps', 'api', '.env.example')), /FILES_STORAGE_DRIVER=local/);
        assert.match(
          readFile(path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts')),
          /@Post\('files'\)/,
        );
      },
    },
    {
      name: 'queue',
      moduleId: 'queue',
      dbPrismaEnabled: false,
      setup: [],
      verify(projectRoot) {
        assert.equal(fs.existsSync(path.join(projectRoot, 'packages', 'queue', 'package.json')), true);
        assert.match(readFile(path.join(projectRoot, 'infra', 'docker', 'compose.yml')), /^\s{2}redis:\s*$/m);
        assert.match(
          readFile(path.join(projectRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts')),
          /@Get\('queue'\)/,
        );
      },
    },
  ];

  it('reapplying representative implemented modules is a no-op on project files', () => {
    for (const scenario of scenarios) {
      const tempRoot = makeTempDir(`forgeon-idempotent-${scenario.name}-`);
      const projectRoot = path.join(tempRoot, `demo-${scenario.name}`);

      try {
        scaffoldBaseProject({
          packageRoot,
          targetRoot: projectRoot,
          projectName: `demo-${scenario.name}`,
          dbPrismaEnabled: scenario.dbPrismaEnabled,
        });

        for (const moduleId of scenario.setup) {
          addModule({ moduleId, targetRoot: projectRoot, packageRoot });
        }

        const firstResult = addModule({ moduleId: scenario.moduleId, targetRoot: projectRoot, packageRoot });
        assert.equal(firstResult.applied, true);
        scenario.verify(projectRoot);

        const before = readProjectSnapshot(projectRoot);
        const secondResult = addModule({ moduleId: scenario.moduleId, targetRoot: projectRoot, packageRoot });
        const after = readProjectSnapshot(projectRoot);

        assert.equal(secondResult.applied, true);
        assert.deepEqual(after, before);
        scenario.verify(projectRoot);
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }
  });
});
