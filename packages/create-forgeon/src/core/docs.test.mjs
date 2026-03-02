import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDocs } from './docs.mjs';

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('generateDocs', () => {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(thisDir, '..', '..');

  it('generates docs for proxy=none without i18n section', () => {
    const targetRoot = makeTempDir('forgeon-docs-off-');

    try {
      generateDocs(
        targetRoot,
        {
          frontend: 'react',
          db: 'prisma',
          dbPrismaEnabled: false,
          dockerEnabled: true,
          i18nEnabled: false,
          proxy: 'none',
        },
        packageRoot,
      );

      const readme = readFile(path.join(targetRoot, 'README.md'));

      assert.match(readme, /db-prisma`: `disabled`/);
      assert.match(readme, /No DB module is enabled by default/);
      assert.match(readme, /Quick Start \(Docker\)/);
      assert.match(readme, /Proxy Preset: none/);
      assert.match(readme, /Error Handling \(`core-errors`\)/);
      assert.match(readme, /Module notes index: `modules\/README\.md`/);
      assert.doesNotMatch(readme, /i18n Configuration/);
      assert.doesNotMatch(readme, /Prisma In Container Start/);
      assert.equal(fs.existsSync(path.join(targetRoot, 'docs')), false);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('generates docker and caddy notes when enabled', () => {
    const targetRoot = makeTempDir('forgeon-docs-on-');

    try {
      generateDocs(
        targetRoot,
        {
          frontend: 'react',
          db: 'prisma',
          dbPrismaEnabled: true,
          dockerEnabled: true,
          i18nEnabled: true,
          proxy: 'caddy',
        },
        packageRoot,
      );

      const readme = readFile(path.join(targetRoot, 'README.md'));

      assert.match(readme, /Quick Start \(Docker\)/);
      assert.match(readme, /Proxy Preset: Caddy/);
      assert.match(readme, /i18n Configuration/);
      assert.match(readme, /db-prisma`: `enabled`/);
      assert.match(readme, /Prisma In Container Start/);
      assert.match(readme, /Error Handling \(`core-errors`\)/);
      assert.match(readme, /Module-specific notes: `modules\/<module-id>\/README\.md`/);
      assert.equal(fs.existsSync(path.join(targetRoot, 'docs')), false);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });
});
