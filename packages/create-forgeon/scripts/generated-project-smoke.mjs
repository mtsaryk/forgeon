import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaffoldProject } from '../src/core/scaffold.mjs';

function parseFlag(argv, name, fallback) {
  const prefix = `--${name}=`;
  const match = argv.find((arg) => arg.startsWith(prefix));
  if (!match) {
    return fallback;
  }

  return match.slice(prefix.length);
}

function parseBooleanFlag(argv, name, fallback) {
  const value = parseFlag(argv, name, null);
  if (value === null) {
    return fallback;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`Expected --${name}=true|false, received: ${value}`);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertGeneratedProject(targetRoot, proxy, { dbPrismaEnabled, i18nEnabled }) {
  const packageJson = JSON.parse(read(path.join(targetRoot, 'package.json')));
  const readme = read(path.join(targetRoot, 'README.md'));
  const compose = read(path.join(targetRoot, 'infra', 'docker', 'compose.yml'));
  const appTsx = read(path.join(targetRoot, 'apps', 'web', 'src', 'App.tsx'));
  const probesTs = read(path.join(targetRoot, 'apps', 'web', 'src', 'probes.ts'));
  const healthController = read(path.join(targetRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts'));
  const apiEnv = read(path.join(targetRoot, 'apps', 'api', '.env.example'));

  assert.equal(fs.existsSync(path.join(targetRoot, 'docs')), false);
  assert.equal(packageJson.scripts['forgeon:sync-integrations'], 'node scripts/forgeon-sync-integrations.mjs');
  assert.equal(packageJson.scripts.build, 'pnpm -r build');
  assert.equal(packageJson.forgeon?.diagnostics?.probes?.enabled, true);
  assert.match(readme, /Module notes index: `modules\/README\.md`/);
  assert.match(appTsx, /id="probes"/);
  assert.match(probesTs, /export const probeDefinitions =/);
  assert.match(healthController, /@Controller\('health'\)/);

  if (dbPrismaEnabled) {
    assert.match(apiEnv, /DATABASE_URL=postgresql:\/\/postgres:postgres@localhost:5432\/app\?schema=public/);
  } else {
    assert.doesNotMatch(apiEnv, /DATABASE_URL=/);
  }

  if (i18nEnabled) {
    assert.match(apiEnv, /I18N_DEFAULT_LANG=en/);
    assert.match(apiEnv, /I18N_FALLBACK_LANG=en/);
  } else {
    assert.doesNotMatch(apiEnv, /I18N_DEFAULT_LANG=/);
    assert.doesNotMatch(apiEnv, /I18N_FALLBACK_LANG=/);
  }

  if (proxy === 'caddy') {
    assert.match(readme, /Proxy Preset: Caddy/);
    assert.match(compose, /^\s{2}caddy:\s*$/m);
    assert.equal(fs.existsSync(path.join(targetRoot, 'infra', 'caddy')), true);
    assert.equal(fs.existsSync(path.join(targetRoot, 'infra', 'nginx')), false);
  } else if (proxy === 'nginx') {
    assert.match(readme, /Proxy Preset: Nginx/);
    assert.match(compose, /^\s{2}nginx:\s*$/m);
    assert.equal(fs.existsSync(path.join(targetRoot, 'infra', 'nginx')), true);
    assert.equal(fs.existsSync(path.join(targetRoot, 'infra', 'caddy')), false);
  } else {
    assert.match(readme, /Proxy Preset: none/);
    assert.doesNotMatch(compose, /^\s{2}caddy:\s*$/m);
    assert.doesNotMatch(compose, /^\s{2}nginx:\s*$/m);
    assert.equal(fs.existsSync(path.join(targetRoot, 'infra', 'nginx')), false);
    assert.equal(fs.existsSync(path.join(targetRoot, 'infra', 'caddy')), false);
  }
}

const argv = process.argv.slice(2);
const proxy = parseFlag(argv, 'proxy', 'caddy');
const dbPrismaEnabled = parseBooleanFlag(argv, 'db-prisma', true);
const i18nEnabled = parseBooleanFlag(argv, 'i18n', true);
const keep = argv.includes('--keep');
const name = parseFlag(argv, 'name', 'forgeon-smoke-app');

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(thisDir, '..');
const templateRoot = path.join(packageRoot, 'templates', 'base');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeon-generated-smoke-'));
const targetRoot = path.join(tempRoot, name);

try {
  scaffoldProject({
    templateRoot,
    packageRoot,
    targetRoot,
    projectName: name,
    frontend: 'react',
    db: 'prisma',
    dbPrismaEnabled,
    i18nEnabled,
    proxy,
  });

  assertGeneratedProject(targetRoot, proxy, { dbPrismaEnabled, i18nEnabled });

  console.log('Generated project smoke check passed.');
  console.log(`- path: ${targetRoot}`);
  console.log(`- proxy: ${proxy}`);
  console.log(`- db-prisma: ${dbPrismaEnabled}`);
  console.log(`- i18n: ${i18nEnabled}`);
  console.log(`- kept: ${keep}`);
} finally {
  if (!keep) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
