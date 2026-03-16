import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDocs } from './docs.mjs';
import { scaffoldProject } from './scaffold.mjs';

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
      assert.doesNotMatch(readme, /docs\/README\.md/);
      assert.doesNotMatch(readme, /docs\/Agents\.md/);
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
      assert.doesNotMatch(readme, /docs\/README\.md/);
      assert.doesNotMatch(readme, /docs\/Agents\.md/);
      assert.equal(fs.existsSync(path.join(targetRoot, 'docs')), false);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('scaffolds a generated project without copying internal docs payload', () => {
    const tempRoot = makeTempDir('forgeon-scaffold-doc-boundary-');
    const targetRoot = path.join(tempRoot, 'demo-doc-boundary');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot,
        projectName: 'demo-doc-boundary',
        frontend: 'react',
        db: 'prisma',
        dbPrismaEnabled: true,
        i18nEnabled: true,
        proxy: 'caddy',
      });

      const readme = readFile(path.join(targetRoot, 'README.md'));
      const packageJson = readFile(path.join(targetRoot, 'package.json'));

      assert.equal(fs.existsSync(path.join(targetRoot, 'docs')), false);
      assert.match(readme, /Module notes index: `modules\/README\.md`/);
      assert.doesNotMatch(readme, /temporary template placeholder/i);
      assert.doesNotMatch(readme, /built-in docs/i);
      assert.doesNotMatch(readme, /docs\/README\.md/);
      assert.doesNotMatch(readme, /docs\/Agents\.md/);
      assert.doesNotMatch(packageJson, /"create:forgeon"/);
      assert.match(packageJson, /"forgeon:sync-integrations"/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
