import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  collectProvidedCapabilities,
  detectInstalledModules,
  getPendingOptionalIntegrations,
  getPendingRecommendedCompanions,
  resolveAllModulesInstallPlan,
  resolveModuleInstallPlan,
} from './dependencies.mjs';

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

const TEST_PRESETS = [
  {
    id: 'db-prisma',
    label: 'DB Prisma',
    implemented: true,
    detectionPaths: ['packages/db-prisma/package.json'],
    provides: ['db-adapter'],
    requires: [],
    optionalIntegrations: [],
  },
  {
    id: 'communications',
    label: 'Communications',
    implemented: true,
    detectionPaths: ['packages/communications/package.json'],
    provides: ['communications-runtime'],
    requires: [],
    optionalIntegrations: [],
  },
  {
    id: 'accounts',
    label: 'Accounts',
    implemented: true,
    detectionPaths: ['packages/accounts-api/package.json'],
    provides: ['accounts-runtime'],
    requires: [{ type: 'capability', id: 'db-adapter' }, { type: 'capability', id: 'communications-runtime' }],
    optionalIntegrations: [
      {
        id: 'accounts-rbac',
        title: 'Accounts RBAC Compatibility Sync',
        modules: ['accounts', 'rbac'],
        requires: [{ type: 'module', id: 'rbac' }],
        description: ['Prepare accounts auth claims compatibility'],
        followUpCommands: [
          'npx create-forgeon@latest add rbac',
          'pnpm forgeon:sync-integrations',
        ],
      },
    ],
  },
  {
    id: 'rbac',
    label: 'RBAC',
    implemented: true,
    detectionPaths: ['packages/rbac/package.json'],
    provides: ['rbac-runtime'],
    requires: [],
    optionalIntegrations: [
      {
        id: 'accounts-rbac',
        title: 'Accounts RBAC Compatibility Sync',
        modules: ['accounts', 'rbac'],
        requires: [{ type: 'module', id: 'accounts' }],
        description: ['Prepare accounts auth claims compatibility'],
        followUpCommands: [
          'npx create-forgeon@latest add accounts',
          'pnpm forgeon:sync-integrations',
        ],
      },
    ],
  },
  {
    id: 'files',
    label: 'Files',
    implemented: true,
    detectionPaths: ['packages/files/package.json'],
    provides: ['files-runtime'],
    requires: [
      { type: 'capability', id: 'db-adapter' },
      { type: 'capability', id: 'files-storage-adapter' },
    ],
    recommendedCompanions: [
      {
        id: 'files-image',
        title: 'Files Image Hardening',
      },
    ],
    optionalIntegrations: [],
  },
  {
    id: 'files-local',
    label: 'Files Local Adapter',
    implemented: true,
    detectionPaths: ['packages/files-local/package.json'],
    provides: ['files-storage-adapter'],
    requires: [],
    optionalIntegrations: [],
  },
  {
    id: 'files-s3',
    label: 'Files S3 Adapter',
    implemented: true,
    detectionPaths: ['packages/files-s3/package.json'],
    provides: ['files-storage-adapter'],
    requires: [],
    optionalIntegrations: [],
  },
  {
    id: 'files-access',
    label: 'Files Access',
    implemented: true,
    detectionPaths: ['packages/files-access/package.json'],
    provides: ['files-access-runtime'],
    requires: [{ type: 'module', id: 'files' }],
    optionalIntegrations: [],
  },
  {
    id: 'files-quotas',
    label: 'Files Quotas',
    implemented: true,
    detectionPaths: ['packages/files-quotas/package.json'],
    provides: ['files-quotas-runtime'],
    requires: [{ type: 'module', id: 'files' }],
    optionalIntegrations: [],
  },
  {
    id: 'files-image',
    label: 'Files Image',
    implemented: true,
    detectionPaths: ['packages/files-image/package.json'],
    provides: ['files-image-runtime'],
    requires: [{ type: 'module', id: 'files' }],
    optionalIntegrations: [],
  },
  {
    id: 'queue',
    label: 'Queue',
    implemented: true,
    detectionPaths: ['packages/queue/package.json'],
    provides: ['queue-runtime'],
    requires: [],
    optionalIntegrations: [],
  },
  {
    id: 'scheduler',
    label: 'Scheduler',
    implemented: true,
    detectionPaths: ['packages/scheduler/package.json'],
    provides: ['scheduler-runtime'],
    requires: [{ type: 'capability', id: 'queue-runtime' }],
    optionalIntegrations: [],
  },
];

describe('module dependency helpers', () => {
  it('detects installed modules from detection paths', () => {
    const targetRoot = mkTmp('forgeon-deps-detect-');
    try {
      fs.mkdirSync(path.join(targetRoot, 'packages', 'db-prisma'), { recursive: true });
      fs.writeFileSync(path.join(targetRoot, 'packages', 'db-prisma', 'package.json'), '{}\n', 'utf8');

      const installed = detectInstalledModules(targetRoot, TEST_PRESETS);
      assert.equal(installed.has('db-prisma'), true);
      assert.equal(installed.has('files'), false);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('collects provided capabilities from installed module ids', () => {
    const capabilities = collectProvidedCapabilities(new Set(['db-prisma']), TEST_PRESETS);
    assert.deepEqual([...capabilities], ['db-adapter']);
  });

  it('fails in non-interactive mode without --with-required when a capability is missing', async () => {
    const targetRoot = mkTmp('forgeon-deps-fail-');

    try {
      await assert.rejects(
        () =>
          resolveModuleInstallPlan({
            moduleId: 'files',
            targetRoot,
            presets: TEST_PRESETS,
            withRequired: false,
            isInteractive: false,
          }),
        /required capability "db-adapter" is missing/,
      );
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('builds a concrete install plan for accounts with required db-adapter', async () => {
    const targetRoot = mkTmp('forgeon-deps-accounts-');

    try {
      const result = await resolveModuleInstallPlan({
        moduleId: 'accounts',
        targetRoot,
        presets: TEST_PRESETS,
        withRequired: true,
        isInteractive: false,
      });

      assert.equal(result.cancelled, false);
      assert.deepEqual(result.moduleSequence, ['db-prisma', 'communications', 'accounts']);
      assert.deepEqual(result.selectedProviders, {
        'db-adapter': 'db-prisma',
        'communications-runtime': 'communications',
      });
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('fails in non-interactive mode with --with-required when capability provider mapping is ambiguous', async () => {
    const targetRoot = mkTmp('forgeon-deps-provider-required-');

    try {
      await assert.rejects(
        () =>
          resolveModuleInstallPlan({
            moduleId: 'files',
            targetRoot,
            presets: TEST_PRESETS,
            withRequired: true,
            isInteractive: false,
          }),
        /required capability "files-storage-adapter" is missing/,
      );
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('builds a concrete install plan in non-interactive mode with --with-required and --provider', async () => {
    const targetRoot = mkTmp('forgeon-deps-plan-');

    try {
      const result = await resolveModuleInstallPlan({
        moduleId: 'files',
        targetRoot,
        presets: TEST_PRESETS,
        withRequired: true,
        providerSelections: {
          'files-storage-adapter': 'files-local',
        },
        isInteractive: false,
      });

      assert.equal(result.cancelled, false);
      assert.deepEqual(result.moduleSequence, ['db-prisma', 'files-local', 'files']);
      assert.deepEqual(result.selectedProviders, {
        'db-adapter': 'db-prisma',
        'files-storage-adapter': 'files-local',
      });
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('resolves files-access plan through files core module dependency', async () => {
    const targetRoot = mkTmp('forgeon-deps-files-access-plan-');

    try {
      const result = await resolveModuleInstallPlan({
        moduleId: 'files-access',
        targetRoot,
        presets: TEST_PRESETS,
        withRequired: true,
        providerSelections: {
          'files-storage-adapter': 'files-local',
        },
        isInteractive: false,
      });

      assert.equal(result.cancelled, false);
      assert.deepEqual(result.moduleSequence, ['db-prisma', 'files-local', 'files', 'files-access']);
      assert.deepEqual(result.selectedProviders, {
        'db-adapter': 'db-prisma',
        'files-storage-adapter': 'files-local',
      });
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('resolves files-quotas plan through files core module dependency', async () => {
    const targetRoot = mkTmp('forgeon-deps-files-quotas-plan-');

    try {
      const result = await resolveModuleInstallPlan({
        moduleId: 'files-quotas',
        targetRoot,
        presets: TEST_PRESETS,
        withRequired: true,
        providerSelections: {
          'files-storage-adapter': 'files-local',
        },
        isInteractive: false,
      });

      assert.equal(result.cancelled, false);
      assert.deepEqual(result.moduleSequence, ['db-prisma', 'files-local', 'files', 'files-quotas']);
      assert.deepEqual(result.selectedProviders, {
        'db-adapter': 'db-prisma',
        'files-storage-adapter': 'files-local',
      });
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('resolves files-image plan through files core module dependency', async () => {
    const targetRoot = mkTmp('forgeon-deps-files-image-plan-');

    try {
      const result = await resolveModuleInstallPlan({
        moduleId: 'files-image',
        targetRoot,
        presets: TEST_PRESETS,
        withRequired: true,
        providerSelections: {
          'files-storage-adapter': 'files-local',
        },
        isInteractive: false,
      });

      assert.equal(result.cancelled, false);
      assert.deepEqual(result.moduleSequence, ['db-prisma', 'files-local', 'files', 'files-image']);
      assert.deepEqual(result.selectedProviders, {
        'db-adapter': 'db-prisma',
        'files-storage-adapter': 'files-local',
      });
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('resolves scheduler plan through queue-runtime capability chain', async () => {
    const targetRoot = mkTmp('forgeon-deps-scheduler-plan-');

    try {
      const result = await resolveModuleInstallPlan({
        moduleId: 'scheduler',
        targetRoot,
        presets: TEST_PRESETS,
        withRequired: true,
        isInteractive: false,
      });

      assert.equal(result.cancelled, false);
      assert.deepEqual(result.moduleSequence, ['queue', 'scheduler']);
      assert.deepEqual(result.selectedProviders, {
        'queue-runtime': 'queue',
      });
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('builds a full install plan with the recommended provider for ambiguous capabilities', async () => {
    const targetRoot = mkTmp('forgeon-deps-all-plan-');

    try {
      const result = await resolveAllModulesInstallPlan({
        targetRoot,
        presets: TEST_PRESETS,
        isInteractive: false,
      });

      assert.equal(result.cancelled, false);
      assert.deepEqual(result.moduleSequence, [
        'db-prisma',
        'communications',
        'accounts',
        'rbac',
        'files-local',
        'files',
        'files-access',
        'files-quotas',
        'files-image',
        'queue',
        'scheduler',
      ]);
      assert.deepEqual(result.selectedProviders, {
        'files-storage-adapter': 'files-local',
        'db-adapter': 'db-prisma',
        'communications-runtime': 'communications',
        'files-runtime': 'files',
        'queue-runtime': 'queue',
      });
      assert.equal(result.rootModuleIds.includes('files-s3'), false);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('builds a full install plan with an explicit provider override', async () => {
    const targetRoot = mkTmp('forgeon-deps-all-provider-');

    try {
      const result = await resolveAllModulesInstallPlan({
        targetRoot,
        presets: TEST_PRESETS,
        isInteractive: false,
        providerSelections: {
          'files-storage-adapter': 'files-s3',
        },
      });

      assert.equal(result.cancelled, false);
      assert.equal(result.moduleSequence.includes('files-s3'), true);
      assert.equal(result.moduleSequence.includes('files-local'), false);
      assert.equal(result.selectedProviders['files-storage-adapter'], 'files-s3');
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('reports pending optional integrations for accounts when rbac is missing', () => {
    const targetRoot = mkTmp('forgeon-deps-optional-');
    try {
      fs.mkdirSync(path.join(targetRoot, 'packages', 'accounts-api'), { recursive: true });
      fs.writeFileSync(path.join(targetRoot, 'packages', 'accounts-api', 'package.json'), '{}\n', 'utf8');

      const pending = getPendingOptionalIntegrations({
        moduleId: 'accounts',
        targetRoot,
        presets: TEST_PRESETS,
      });

      assert.equal(pending.length, 1);
      assert.equal(pending[0].id, 'accounts-rbac');
      assert.equal(pending[0].missing[0].id, 'rbac');
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('keeps the requested module in the plan even when it is already installed', async () => {
    const targetRoot = mkTmp('forgeon-deps-reapply-');

    try {
      fs.mkdirSync(path.join(targetRoot, 'packages', 'db-prisma'), { recursive: true });
      fs.writeFileSync(path.join(targetRoot, 'packages', 'db-prisma', 'package.json'), '{}\n', 'utf8');

      const result = await resolveModuleInstallPlan({
        moduleId: 'db-prisma',
        targetRoot,
        presets: TEST_PRESETS,
        isInteractive: false,
      });

      assert.deepEqual(result.moduleSequence, ['db-prisma']);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('reports pending recommended companions for installed module context', () => {
    const targetRoot = mkTmp('forgeon-deps-recommended-');
    try {
      fs.mkdirSync(path.join(targetRoot, 'packages', 'files'), { recursive: true });
      fs.writeFileSync(path.join(targetRoot, 'packages', 'files', 'package.json'), '{}\n', 'utf8');

      const pending = getPendingRecommendedCompanions({
        moduleId: 'files',
        targetRoot,
        presets: TEST_PRESETS,
      });

      assert.equal(pending.length, 1);
      assert.equal(pending[0].id, 'files-image');
      assert.match(pending[0].title, /Files Image Hardening/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('does not report recommended companions that are already installed', () => {
    const targetRoot = mkTmp('forgeon-deps-recommended-installed-');
    try {
      fs.mkdirSync(path.join(targetRoot, 'packages', 'files'), { recursive: true });
      fs.mkdirSync(path.join(targetRoot, 'packages', 'files-image'), { recursive: true });
      fs.writeFileSync(path.join(targetRoot, 'packages', 'files', 'package.json'), '{}\n', 'utf8');
      fs.writeFileSync(path.join(targetRoot, 'packages', 'files-image', 'package.json'), '{}\n', 'utf8');

      const pending = getPendingRecommendedCompanions({
        moduleId: 'files',
        targetRoot,
        presets: TEST_PRESETS,
      });

      assert.equal(pending.length, 0);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });
});


