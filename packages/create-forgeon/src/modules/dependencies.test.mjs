import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  collectProvidedCapabilities,
  detectInstalledModules,
  getPendingOptionalIntegrations,
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
    id: 'files',
    label: 'Files',
    implemented: false,
    detectionPaths: ['packages/files/package.json'],
    provides: ['files-runtime'],
    requires: [{ type: 'capability', id: 'db-adapter' }],
    optionalIntegrations: [],
  },
  {
    id: 'jwt-auth',
    label: 'JWT Auth',
    implemented: true,
    detectionPaths: ['packages/auth-api/package.json'],
    provides: ['auth-runtime'],
    requires: [],
    optionalIntegrations: [
      {
        id: 'auth-persistence',
        title: 'Auth Persistence Integration',
        modules: ['jwt-auth', 'db-adapter'],
        requires: [{ type: 'capability', id: 'db-adapter' }],
        description: ['Persist refresh-token state'],
        followUpCommands: [
          'npx create-forgeon@latest add db-prisma',
          'pnpm forgeon:sync-integrations',
        ],
      },
    ],
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

  it('builds a concrete install plan in non-interactive mode with --with-required', async () => {
    const targetRoot = mkTmp('forgeon-deps-plan-');

    try {
      const result = await resolveModuleInstallPlan({
        moduleId: 'files',
        targetRoot,
        presets: TEST_PRESETS,
        withRequired: true,
        isInteractive: false,
      });

      assert.equal(result.cancelled, false);
      assert.deepEqual(result.moduleSequence, ['db-prisma', 'files']);
      assert.deepEqual(result.selectedProviders, { 'db-adapter': 'db-prisma' });
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('reports missing optional integrations for the installed module', () => {
    const targetRoot = mkTmp('forgeon-deps-optional-');
    try {
      fs.mkdirSync(path.join(targetRoot, 'packages', 'auth-api'), { recursive: true });
      fs.writeFileSync(path.join(targetRoot, 'packages', 'auth-api', 'package.json'), '{}\n', 'utf8');

      const pending = getPendingOptionalIntegrations({
        moduleId: 'jwt-auth',
        targetRoot,
        presets: TEST_PRESETS,
      });

      assert.equal(pending.length, 1);
      assert.equal(pending[0].id, 'auth-persistence');
      assert.equal(pending[0].missing[0].id, 'db-adapter');
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
});
