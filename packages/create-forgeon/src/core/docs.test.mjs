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
          dockerEnabled: true,
          i18nEnabled: false,
          proxy: 'none',
        },
        packageRoot,
      );

      const readme = readFile(path.join(targetRoot, 'README.md'));
      const projectDoc = readFile(path.join(targetRoot, 'docs', 'AI', 'PROJECT.md'));
      const architectureDoc = readFile(path.join(targetRoot, 'docs', 'AI', 'ARCHITECTURE.md'));

      assert.match(readme, /Docker\/infra: `enabled`/);
      assert.match(readme, /Quick Start \(Docker\)/);
      assert.match(readme, /Proxy Preset: none/);
      assert.doesNotMatch(readme, /i18n Configuration/);

      assert.match(projectDoc, /### Docker mode/);
      assert.match(projectDoc, /Active proxy preset: `none`/);
      assert.doesNotMatch(projectDoc, /packages\/i18n/);

      assert.match(architectureDoc, /infra\/\*/);
      assert.doesNotMatch(architectureDoc, /I18N_ENABLED/);
      assert.match(architectureDoc, /TypeScript Module Policy/);
      assert.match(architectureDoc, /tsconfig\.base\.esm\.json/);
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

      assert.match(projectDoc, /`infra` - Docker Compose \(always\) \+ proxy preset \(`caddy`\)/);
      assert.match(projectDoc, /Main proxy config: `infra\/caddy\/Caddyfile`/);

      assert.match(architectureDoc, /infra\/\*/);
      assert.match(architectureDoc, /I18N_ENABLED/);
      assert.match(architectureDoc, /Active reverse proxy preset: `caddy`/);
      assert.match(architectureDoc, /TypeScript Module Policy/);
      assert.match(architectureDoc, /tsconfig\.base\.node\.json/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });
});
