import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addModule } from './executor.mjs';
import { scaffoldProject } from '../core/scaffold.mjs';

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createMinimalForgeonProject(targetRoot) {
  fs.mkdirSync(path.join(targetRoot, 'apps', 'api'), { recursive: true });
  fs.writeFileSync(path.join(targetRoot, 'package.json'), '{"name":"demo"}\n', 'utf8');
  fs.writeFileSync(path.join(targetRoot, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n', 'utf8');
}

describe('addModule', () => {
  const modulesDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(modulesDir, '..', '..');

  it('creates module docs note for planned module', () => {
    const targetRoot = mkTmp('forgeon-module-');
    try {
      createMinimalForgeonProject(targetRoot);
      const result = addModule({
        moduleId: 'jwt-auth',
        targetRoot,
        packageRoot,
      });

      assert.equal(result.applied, false);
      assert.match(result.message, /planned/);
      assert.equal(fs.existsSync(result.docsPath), true);

      const note = fs.readFileSync(result.docsPath, 'utf8');
      assert.match(note, /JWT Auth/);
      assert.match(note, /Status: planned/);
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('throws for unknown module id', () => {
    const targetRoot = mkTmp('forgeon-module-unknown-');
    try {
      createMinimalForgeonProject(targetRoot);
      assert.throws(
        () =>
          addModule({
            moduleId: 'unknown-module',
            targetRoot,
            packageRoot,
          }),
        /Unknown module/,
      );
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it('applies i18n module on top of scaffold without i18n', () => {
    const targetRoot = mkTmp('forgeon-module-i18n-');
    const projectRoot = path.join(targetRoot, 'demo-i18n');
    const templateRoot = path.join(packageRoot, 'templates', 'base');

    try {
      scaffoldProject({
        templateRoot,
        packageRoot,
        targetRoot: projectRoot,
        projectName: 'demo-i18n',
        frontend: 'react',
        db: 'prisma',
        i18nEnabled: false,
        proxy: 'caddy',
      });

      const result = addModule({
        moduleId: 'i18n',
        targetRoot: projectRoot,
        packageRoot,
      });

      assert.equal(result.applied, true);
      assert.match(result.message, /applied/);
      assert.equal(
        fs.existsSync(path.join(projectRoot, 'packages', 'i18n-contracts', 'package.json')),
        true,
      );
      assert.equal(
        fs.existsSync(path.join(projectRoot, 'packages', 'i18n-web', 'package.json')),
        true,
      );

      const apiPackage = fs.readFileSync(path.join(projectRoot, 'apps', 'api', 'package.json'), 'utf8');
      assert.match(apiPackage, /@forgeon\/i18n/);
      assert.match(apiPackage, /@forgeon\/i18n-contracts/);

      const compose = fs.readFileSync(path.join(projectRoot, 'infra', 'docker', 'compose.yml'), 'utf8');
      assert.match(compose, /I18N_ENABLED/);

      const appTsx = fs.readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'App.tsx'), 'utf8');
      assert.match(appTsx, /@forgeon\/i18n-web/);
      assert.match(appTsx, /\/api\/health\/meta/);
      assert.match(appTsx, /checkApiHealth/);

      const i18nWebPackage = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n-web', 'package.json'),
        'utf8',
      );
      assert.match(i18nWebPackage, /"type": "module"/);

      const i18nWebTsconfig = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n-web', 'tsconfig.json'),
        'utf8',
      );
      assert.match(i18nWebTsconfig, /"module": "ESNext"/);

      const i18nWebSource = fs.readFileSync(
        path.join(projectRoot, 'packages', 'i18n-web', 'src', 'index.ts'),
        'utf8',
      );
      assert.match(i18nWebSource, /@forgeon\/i18n-contracts\/src\/index/);

      const caddyDockerfile = fs.readFileSync(
        path.join(projectRoot, 'infra', 'docker', 'caddy.Dockerfile'),
        'utf8',
      );
      assert.match(caddyDockerfile, /COPY tsconfig\.base\.json \.\//);
      assert.match(
        caddyDockerfile,
        /COPY packages\/i18n-contracts\/package\.json packages\/i18n-contracts\/package\.json/,
      );
      assert.match(
        caddyDockerfile,
        /COPY packages\/i18n-web\/package\.json packages\/i18n-web\/package\.json/,
      );
    } finally {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
  });
});
