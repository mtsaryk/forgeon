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
      const projectDoc = readFile(path.join(targetRoot, 'docs', 'AI', 'PROJECT.md'));
      const architectureDoc = readFile(path.join(targetRoot, 'docs', 'AI', 'ARCHITECTURE.md'));

      assert.match(readme, /db-prisma`: `disabled`/);
      assert.match(readme, /No DB module is enabled by default/);
      assert.match(readme, /Quick Start \(Docker\)/);
      assert.match(readme, /Proxy Preset: none/);
      assert.match(readme, /Error Handling \(`core-errors`\)/);
      assert.doesNotMatch(readme, /i18n Configuration/);
      assert.doesNotMatch(readme, /Prisma In Container Start/);

      assert.match(projectDoc, /### Docker mode/);
      assert.match(projectDoc, /Active proxy preset: `none`/);
      assert.match(projectDoc, /CoreErrorsModule/);
      assert.doesNotMatch(projectDoc, /packages\/i18n/);

      assert.match(architectureDoc, /generated without `db-prisma`/);
      assert.doesNotMatch(architectureDoc, /I18N_ENABLED/);
      assert.match(architectureDoc, /API_PREFIX/);
      assert.match(architectureDoc, /Config Strategy/);
      assert.match(architectureDoc, /TypeScript Module Policy/);
      assert.match(architectureDoc, /tsconfig\.base\.esm\.json/);
      assert.doesNotMatch(architectureDoc, /DbPrismaModule/);
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
      const projectDoc = readFile(path.join(targetRoot, 'docs', 'AI', 'PROJECT.md'));
      const architectureDoc = readFile(path.join(targetRoot, 'docs', 'AI', 'ARCHITECTURE.md'));

      assert.match(readme, /Quick Start \(Docker\)/);
      assert.match(readme, /Proxy Preset: Caddy/);
      assert.match(readme, /i18n Configuration/);
      assert.match(readme, /db-prisma`: `enabled`/);
      assert.match(readme, /Prisma In Container Start/);
      assert.match(readme, /Error Handling \(`core-errors`\)/);

      assert.match(projectDoc, /`infra` - Docker Compose \(always\) \+ proxy preset \(`caddy`\)/);
      assert.match(projectDoc, /Main proxy config: `infra\/caddy\/Caddyfile`/);
      assert.match(projectDoc, /CoreExceptionFilter/);

      assert.match(architectureDoc, /infra\/\*/);
      assert.match(architectureDoc, /I18N_DEFAULT_LANG/);
      assert.doesNotMatch(architectureDoc, /I18N_ENABLED/);
      assert.match(architectureDoc, /Active reverse proxy preset: `caddy`/);
      assert.match(architectureDoc, /TypeScript Module Policy/);
      assert.match(architectureDoc, /tsconfig\.base\.node\.json/);
      assert.match(architectureDoc, /DbPrismaModule/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });
});
