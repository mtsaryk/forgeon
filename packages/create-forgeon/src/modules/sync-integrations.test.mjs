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

  it('does not expose auth persistence integration without a db-adapter provider', () => {
    const tempRoot = makeTempDir('forgeon-sync-no-provider-');
    const projectRoot = path.join(tempRoot, 'demo-sync-no-provider');

    try {
      scaffoldBaseProject({
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-sync-no-provider',
      });

      addModule({ moduleId: 'jwt-auth', targetRoot: projectRoot, packageRoot });

      const scan = scanIntegrations({
        targetRoot: projectRoot,
        relatedModuleId: 'jwt-auth',
      });
      assert.equal(scan.groups.some((group) => group.id === 'auth-persistence'), false);

      const syncResult = syncIntegrations({
        targetRoot: projectRoot,
        packageRoot,
        groupIds: ['auth-persistence'],
      });
      assert.deepEqual(syncResult.summary, []);
      assert.deepEqual(syncResult.changedFiles, []);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('treats auth persistence sync as a no-op after it has already been applied', () => {
    const tempRoot = makeTempDir('forgeon-sync-db-noop-');
    const projectRoot = path.join(tempRoot, 'demo-sync-db-noop');

    try {
      scaffoldBaseProject({
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-sync-db-noop',
        dbPrismaEnabled: true,
      });

      addModule({ moduleId: 'jwt-auth', targetRoot: projectRoot, packageRoot });

      const firstSync = syncIntegrations({
        targetRoot: projectRoot,
        packageRoot,
        groupIds: ['auth-persistence'],
      });
      assert.equal(firstSync.summary.length, 1);
      assert.equal(firstSync.summary[0].id, 'auth-persistence');
      assert.equal(firstSync.summary[0].result.applied, true);

      const secondScan = scanIntegrations({
        targetRoot: projectRoot,
        relatedModuleId: 'jwt-auth',
      });
      assert.equal(secondScan.groups.some((group) => group.id === 'auth-persistence'), false);

      const secondSync = syncIntegrations({
        targetRoot: projectRoot,
        packageRoot,
        groupIds: ['auth-persistence'],
      });
      assert.deepEqual(secondSync.summary, []);
      assert.deepEqual(secondSync.changedFiles, []);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('treats auth claims sync as a no-op after it has already been applied', () => {
    const tempRoot = makeTempDir('forgeon-sync-rbac-noop-');
    const projectRoot = path.join(tempRoot, 'demo-sync-rbac-noop');

    try {
      scaffoldBaseProject({
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-sync-rbac-noop',
      });

      addModule({ moduleId: 'rbac', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'jwt-auth', targetRoot: projectRoot, packageRoot });

      const firstSync = syncIntegrations({
        targetRoot: projectRoot,
        packageRoot,
        groupIds: ['auth-rbac-claims'],
      });
      assert.equal(firstSync.summary.length, 1);
      assert.equal(firstSync.summary[0].id, 'auth-rbac-claims');
      assert.equal(firstSync.summary[0].result.applied, true);

      const secondScan = scanIntegrations({
        targetRoot: projectRoot,
        relatedModuleId: 'jwt-auth',
      });
      assert.equal(secondScan.groups.some((group) => group.id === 'auth-rbac-claims'), false);

      const secondSync = syncIntegrations({
        targetRoot: projectRoot,
        packageRoot,
        groupIds: ['auth-rbac-claims'],
      });
      assert.deepEqual(secondSync.summary, []);
      assert.deepEqual(secondSync.changedFiles, []);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
  it('uses persistence markers instead of README prose when auth persistence sync runs', () => {
    const tempRoot = makeTempDir('forgeon-sync-db-markers-');
    const projectRoot = path.join(tempRoot, 'demo-sync-db-markers');

    try {
      scaffoldBaseProject({
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-sync-db-markers',
        dbPrismaEnabled: true,
      });

      addModule({ moduleId: 'jwt-auth', targetRoot: projectRoot, packageRoot });

      const readmePath = path.join(projectRoot, 'README.md');
      const customizedReadme = fs
        .readFileSync(readmePath, 'utf8')
        .replace('refresh token persistence: disabled by default', 'refresh token persistence: custom local note');
      fs.writeFileSync(readmePath, customizedReadme, 'utf8');

      const syncResult = syncIntegrations({
        targetRoot: projectRoot,
        packageRoot,
        groupIds: ['auth-persistence'],
      });
      assert.equal(syncResult.summary.length, 1);
      assert.equal(syncResult.summary[0].result.applied, true);

      const readme = fs.readFileSync(readmePath, 'utf8');
      assert.match(readme, /forgeon:jwt-auth:persistence:start/);
      assert.match(readme, /refresh token persistence: enabled through the `db-adapter` capability/);
      assert.match(readme, /0002_auth_refresh_token_hash/);
      assert.doesNotMatch(readme, /custom local note/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('uses RBAC markers instead of the demo credentials heading when auth claims sync runs', () => {
    const tempRoot = makeTempDir('forgeon-sync-rbac-markers-');
    const projectRoot = path.join(tempRoot, 'demo-sync-rbac-markers');

    try {
      scaffoldBaseProject({
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-sync-rbac-markers',
      });

      addModule({ moduleId: 'rbac', targetRoot: projectRoot, packageRoot });
      addModule({ moduleId: 'jwt-auth', targetRoot: projectRoot, packageRoot });

      const readmePath = path.join(projectRoot, 'README.md');
      const customizedReadme = fs
        .readFileSync(readmePath, 'utf8')
        .replace('Default demo credentials:', 'Demo credentials:');
      fs.writeFileSync(readmePath, customizedReadme, 'utf8');

      const syncResult = syncIntegrations({
        targetRoot: projectRoot,
        packageRoot,
        groupIds: ['auth-rbac-claims'],
      });
      assert.equal(syncResult.summary.length, 1);
      assert.equal(syncResult.summary[0].result.applied, true);

      const readme = fs.readFileSync(readmePath, 'utf8');
      assert.match(readme, /forgeon:jwt-auth:rbac:start/);
      assert.match(readme, /RBAC integration: demo auth tokens include `health\.rbac` permission/);
      assert.match(readme, /Demo credentials:/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
