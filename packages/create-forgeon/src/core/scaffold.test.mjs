import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaffoldProject } from './scaffold.mjs';

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertProxyPreset(targetRoot, proxy) {
  const dockerDir = path.join(targetRoot, 'infra', 'docker');
  const compose = readFile(path.join(dockerDir, 'compose.yml'));
  const packageJson = readFile(path.join(targetRoot, 'package.json'));
  const appTsx = readFile(path.join(targetRoot, 'apps', 'web', 'src', 'App.tsx'));
  const probesTs = readFile(path.join(targetRoot, 'apps', 'web', 'src', 'probes.ts'));

  assert.equal(fs.existsSync(path.join(targetRoot, 'docs')), false);
  assert.equal(fs.existsSync(path.join(dockerDir, 'compose.caddy.yml')), false);
  assert.equal(fs.existsSync(path.join(dockerDir, 'compose.nginx.yml')), false);
  assert.equal(fs.existsSync(path.join(dockerDir, 'compose.none.yml')), false);
  assert.match(packageJson, /"forgeon:sync-integrations"/);
  assert.doesNotMatch(packageJson, /"create:forgeon"/);
  assert.match(compose, /^services:\s*$/m);
  assert.match(compose, /^\s{2}api:\s*$/m);

  if (proxy === 'caddy') {
    assert.match(compose, /^\s{2}caddy:\s*$/m);
    assert.doesNotMatch(compose, /^\s{2}nginx:\s*$/m);
    assert.equal(fs.existsSync(path.join(dockerDir, 'caddy.Dockerfile')), true);
    assert.equal(fs.existsSync(path.join(dockerDir, 'nginx.Dockerfile')), false);
    assert.equal(fs.existsSync(path.join(targetRoot, 'infra', 'caddy')), true);
    assert.equal(fs.existsSync(path.join(targetRoot, 'infra', 'nginx')), false);
    return;
  }

  if (proxy === 'nginx') {
    assert.match(compose, /^\s{2}nginx:\s*$/m);
    assert.doesNotMatch(compose, /^\s{2}caddy:\s*$/m);
    assert.equal(fs.existsSync(path.join(dockerDir, 'nginx.Dockerfile')), true);
    assert.equal(fs.existsSync(path.join(dockerDir, 'caddy.Dockerfile')), false);
    assert.equal(fs.existsSync(path.join(targetRoot, 'infra', 'nginx')), true);
    assert.equal(fs.existsSync(path.join(targetRoot, 'infra', 'caddy')), false);
    return;
  }

  assert.doesNotMatch(compose, /^\s{2}caddy:\s*$/m);
  assert.doesNotMatch(compose, /^\s{2}nginx:\s*$/m);
  assert.match(compose, /- "3000:3000"/);
  assert.equal(fs.existsSync(path.join(dockerDir, 'nginx.Dockerfile')), false);
  assert.equal(fs.existsSync(path.join(dockerDir, 'caddy.Dockerfile')), false);
  assert.equal(fs.existsSync(path.join(targetRoot, 'infra', 'nginx')), false);
  assert.equal(fs.existsSync(path.join(targetRoot, 'infra', 'caddy')), false);
}

describe('scaffoldProject', () => {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(thisDir, '..', '..');
  const templateRoot = path.join(packageRoot, 'templates', 'base');
  const cases = [
    { proxy: 'caddy', readmePattern: /Proxy Preset: Caddy/ },
    { proxy: 'nginx', readmePattern: /Proxy Preset: Nginx/ },
    { proxy: 'none', readmePattern: /Proxy Preset: none/ },
  ];

  it('applies proxy presets without leftover reverse-proxy assets', () => {
    for (const testCase of cases) {
      const tempRoot = makeTempDir(`forgeon-scaffold-proxy-${testCase.proxy}-`);
      const targetRoot = path.join(tempRoot, `demo-${testCase.proxy}`);

      try {
        scaffoldProject({
          templateRoot,
          packageRoot,
          targetRoot,
          projectName: `demo-${testCase.proxy}`,
          frontend: 'react',
          db: 'prisma',
          dbPrismaEnabled: false,
          i18nEnabled: false,
          proxy: testCase.proxy,
        });

        const readme = readFile(path.join(targetRoot, 'README.md'));
        assert.match(readme, testCase.readmePattern);
        assert.match(readme, /Module notes index: `modules\/README\.md`/);
        assertProxyPreset(targetRoot, testCase.proxy);
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }
  });
});

