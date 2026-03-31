import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addModule } from './executor.mjs';
import { scanIntegrations, syncIntegrations } from './sync-integrations.mjs';
import { scaffoldProject } from '../core/scaffold.mjs';

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function scaffoldBaseProject({ packageRoot, targetRoot, projectName, dbPrismaEnabled = false }) {
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
    proxy: 'caddy',
  });
}

describe('sync integrations', () => {
  const modulesDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(modulesDir, '..', '..');

  it('does not expose accounts-rbac integration when rbac is missing', () => {
    const tempRoot = makeTempDir('forgeon-sync-no-rbac-');
    const projectRoot = path.join(tempRoot, 'demo-sync-no-rbac');

    try {
      scaffoldBaseProject({
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-sync-no-rbac',
      });

      addModule({ moduleId: 'db-prisma', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'accounts', targetRoot: projectRoot, packageRoot });

      const scan = scanIntegrations({
        targetRoot: projectRoot,
        relatedModuleId: 'accounts',
      });
      assert.equal(scan.groups.some((group) => group.id === 'accounts-rbac'), false);

      const syncResult = syncIntegrations({
        targetRoot: projectRoot,
        groupIds: ['accounts-rbac'],
      });
      assert.deepEqual(syncResult.summary, []);
      assert.deepEqual(syncResult.changedFiles, []);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('treats accounts-rbac sync as a no-op after it has already been applied', () => {
    const tempRoot = makeTempDir('forgeon-sync-rbac-noop-');
    const projectRoot = path.join(tempRoot, 'demo-sync-rbac-noop');

    try {
      scaffoldBaseProject({
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-sync-rbac-noop',
      });

      addModule({ moduleId: 'db-prisma', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'rbac', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'accounts', targetRoot: projectRoot, packageRoot });

      const firstSync = syncIntegrations({
        targetRoot: projectRoot,
        groupIds: ['accounts-rbac'],
      });
      assert.equal(firstSync.summary.length, 1);
      assert.equal(firstSync.summary[0].id, 'accounts-rbac');
      assert.equal(firstSync.summary[0].result.applied, true);

      const secondScan = scanIntegrations({
        targetRoot: projectRoot,
        relatedModuleId: 'accounts',
      });
      assert.equal(secondScan.groups.some((group) => group.id === 'accounts-rbac'), false);

      const secondSync = syncIntegrations({
        targetRoot: projectRoot,
        groupIds: ['accounts-rbac'],
      });
      assert.deepEqual(secondSync.summary, []);
      assert.deepEqual(secondSync.changedFiles, []);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('updates claim types and README markers when accounts-rbac sync runs', () => {
    const tempRoot = makeTempDir('forgeon-sync-rbac-markers-');
    const projectRoot = path.join(tempRoot, 'demo-sync-rbac-markers');

    try {
      scaffoldBaseProject({
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-sync-rbac-markers',
      });

      addModule({ moduleId: 'db-prisma', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'rbac', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'accounts', targetRoot: projectRoot, packageRoot });

      const syncResult = syncIntegrations({
        targetRoot: projectRoot,
        groupIds: ['accounts-rbac'],
      });
      assert.equal(syncResult.summary.length, 1);
      assert.equal(syncResult.summary[0].result.applied, true);

      const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
      const contracts = fs.readFileSync(path.join(projectRoot, 'packages', 'accounts-contracts', 'src', 'index.ts'), 'utf8');
      const authTypes = fs.readFileSync(path.join(projectRoot, 'packages', 'accounts-api', 'src', 'auth.types.ts'), 'utf8');

      assert.match(readme, /forgeon:accounts:rbac:start/);
      assert.match(readme, /base accounts schema remains free of roles and permissions/);
      assert.match(contracts, /roles\?: string\[\];/);
      assert.match(contracts, /permissions\?: string\[\];/);
      assert.match(authTypes, /roles\?: string\[\];/);
      assert.match(authTypes, /permissions\?: string\[\];/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
