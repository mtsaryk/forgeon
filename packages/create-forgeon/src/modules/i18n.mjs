import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive, writeJson } from '../utils/fs.mjs';

function copyFromBase(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'base', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing i18n source template: ${source}`);
  }
  const destination = path.join(targetRoot, relativePath);
  copyRecursive(source, destination);
}

function copyFromPreset(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'module-presets', 'i18n', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing i18n preset template: ${source}`);
  }
  const destination = path.join(targetRoot, relativePath);
  copyRecursive(source, destination);
}

function ensureDependency(packageJson, name, version) {
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  packageJson.dependencies[name] = version;
}

function ensureScript(packageJson, name, command) {
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  packageJson.scripts[name] = command;
}

function upsertEnvLines(filePath, lines) {
  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  }

  const keys = new Set(
    content
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split('=')[0]),
  );

  const append = [];
  for (const line of lines) {
    const key = line.split('=')[0];
    if (!keys.has(key)) {
      append.push(line);
    }
  }

  const next =
    append.length > 0 ? `${content.trimEnd()}\n${append.join('\n')}\n` : `${content.trimEnd()}\n`;
  fs.writeFileSync(filePath, next.replace(/^\n/, ''), 'utf8');
}

function ensureLineAfter(content, anchorLine, lineToInsert) {
  if (content.includes(lineToInsert)) {
    return content;
  }

  const index = content.indexOf(anchorLine);
  if (index < 0) {
    return `${content.trimEnd()}\n${lineToInsert}\n`;
  }

  const insertAt = index + anchorLine.length;
  return `${content.slice(0, insertAt)}\n${lineToInsert}${content.slice(insertAt)}`;
}

function ensureLineBefore(content, anchorLine, lineToInsert) {
  if (content.includes(lineToInsert)) {
    return content;
  }

  const index = content.indexOf(anchorLine);
  if (index < 0) {
    return `${content.trimEnd()}\n${lineToInsert}\n`;
  }

  return `${content.slice(0, index)}${lineToInsert}\n${content.slice(index)}`;
}

function patchApiDockerfile(targetRoot) {
  const dockerfilePath = path.join(targetRoot, 'apps', 'api', 'Dockerfile');
  if (!fs.existsSync(dockerfilePath)) {
    return;
  }

  let content = fs.readFileSync(dockerfilePath, 'utf8').replace(/\r\n/g, '\n');
  content = content.replace(
    /^COPY package\.json pnpm-workspace\.yaml tsconfig\.base\.json \.\/$/m,
    'COPY package.json pnpm-workspace.yaml tsconfig.base.json tsconfig.base.node.json tsconfig.base.esm.json ./',
  );

  content = ensureLineAfter(
    content,
    'COPY packages/core/package.json packages/core/package.json',
    'COPY packages/i18n-contracts/package.json packages/i18n-contracts/package.json',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/i18n-contracts/package.json packages/i18n-contracts/package.json',
    'COPY packages/i18n/package.json packages/i18n/package.json',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/core packages/core',
    'COPY packages/i18n-contracts packages/i18n-contracts',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/i18n-contracts packages/i18n-contracts',
    'COPY packages/i18n packages/i18n',
  );

  content = content
    .replace(/^RUN pnpm --filter @forgeon\/i18n-contracts build\r?\n?/gm, '')
    .replace(/^RUN pnpm --filter @forgeon\/i18n build\r?\n?/gm, '');

  content = ensureLineBefore(
    content,
    'RUN pnpm --filter @forgeon/api prisma:generate',
    'RUN pnpm --filter @forgeon/i18n-contracts build',
  );
  content = ensureLineBefore(
    content,
    'RUN pnpm --filter @forgeon/api prisma:generate',
    'RUN pnpm --filter @forgeon/i18n build',
  );

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchProxyDockerfile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

  content = ensureLineAfter(
    content,
    'COPY package.json pnpm-workspace.yaml ./',
    'COPY tsconfig.base.json ./',
  );
  content = ensureLineAfter(
    content,
    'COPY tsconfig.base.json ./',
    'COPY tsconfig.base.node.json ./',
  );
  content = ensureLineAfter(
    content,
    'COPY tsconfig.base.node.json ./',
    'COPY tsconfig.base.esm.json ./',
  );
  content = ensureLineAfter(
    content,
    'COPY apps/web/package.json apps/web/package.json',
    'COPY packages/i18n-contracts/package.json packages/i18n-contracts/package.json',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/i18n-contracts/package.json packages/i18n-contracts/package.json',
    'COPY packages/i18n-web/package.json packages/i18n-web/package.json',
  );
  content = ensureLineAfter(
    content,
    'COPY apps/web apps/web',
    'COPY packages/i18n-contracts packages/i18n-contracts',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/i18n-contracts packages/i18n-contracts',
    'COPY packages/i18n-web packages/i18n-web',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/i18n-web packages/i18n-web',
    'COPY resources resources',
  );

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchProxyDockerfiles(targetRoot) {
  patchProxyDockerfile(path.join(targetRoot, 'infra', 'docker', 'caddy.Dockerfile'));
  patchProxyDockerfile(path.join(targetRoot, 'infra', 'docker', 'nginx.Dockerfile'));
}

function patchCompose(targetRoot) {
  const composePath = path.join(targetRoot, 'infra', 'docker', 'compose.yml');
  if (!fs.existsSync(composePath)) {
    return;
  }

  let content = fs.readFileSync(composePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes('I18N_DEFAULT_LANG: ${I18N_DEFAULT_LANG}')) {
    content = content.replace(
      /^(\s+DATABASE_URL:.*)$/m,
      `$1
      I18N_DEFAULT_LANG: \${I18N_DEFAULT_LANG}
      I18N_FALLBACK_LANG: \${I18N_FALLBACK_LANG}`,
    );
  }

  fs.writeFileSync(composePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchApiPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'apps', 'api', 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  ensureScript(
    packageJson,
    'predev',
    'pnpm --filter @forgeon/i18n-contracts build && pnpm --filter @forgeon/i18n build',
  );
  ensureDependency(packageJson, '@forgeon/i18n', 'workspace:*');
  ensureDependency(packageJson, '@forgeon/i18n-contracts', 'workspace:*');
  ensureDependency(packageJson, 'nestjs-i18n', '^10.5.1');
  writeJson(packagePath, packageJson);
}

function patchWebPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'apps', 'web', 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  ensureScript(
    packageJson,
    'predev',
    'pnpm --filter @forgeon/i18n-contracts build && pnpm --filter @forgeon/i18n-web build',
  );
  ensureScript(
    packageJson,
    'prebuild',
    'pnpm --filter @forgeon/i18n-contracts build && pnpm --filter @forgeon/i18n-web build',
  );
  ensureDependency(packageJson, '@forgeon/i18n-contracts', 'workspace:*');
  ensureDependency(packageJson, '@forgeon/i18n-web', 'workspace:*');
  ensureDependency(packageJson, 'i18next', '^23.16.8');
  ensureDependency(packageJson, 'react-i18next', '^15.1.2');
  writeJson(packagePath, packageJson);
}

function patchI18nPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'packages', 'i18n', 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  ensureDependency(packageJson, '@forgeon/i18n-contracts', 'workspace:*');
  writeJson(packagePath, packageJson);
}

function patchRootPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  ensureScript(packageJson, 'i18n:check', 'pnpm --filter @forgeon/i18n-contracts check:keys');
  writeJson(packagePath, packageJson);
}

export function applyI18nModule({ packageRoot, targetRoot }) {
  copyFromBase(packageRoot, targetRoot, path.join('packages', 'i18n'));
  copyFromBase(packageRoot, targetRoot, path.join('resources', 'i18n'));

  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'i18n-contracts'));
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'i18n-web'));
  copyFromPreset(packageRoot, targetRoot, path.join('apps', 'web', 'src', 'App.tsx'));
  copyFromPreset(packageRoot, targetRoot, path.join('apps', 'web', 'src', 'i18n.ts'));
  copyFromPreset(packageRoot, targetRoot, path.join('apps', 'web', 'src', 'main.tsx'));

  copyFromBase(packageRoot, targetRoot, path.join('apps', 'api', 'src', 'app.module.ts'));
  copyFromBase(
    packageRoot,
    targetRoot,
    path.join('apps', 'api', 'src', 'health', 'health.controller.ts'),
  );
  copyFromBase(
    packageRoot,
    targetRoot,
    path.join('apps', 'api', 'src', 'common', 'filters', 'app-exception.filter.ts'),
  );

  patchI18nPackage(targetRoot);
  patchApiPackage(targetRoot);
  patchWebPackage(targetRoot);
  patchRootPackage(targetRoot);
  patchApiDockerfile(targetRoot);
  patchProxyDockerfiles(targetRoot);

  upsertEnvLines(path.join(targetRoot, 'apps', 'api', '.env.example'), [
    'I18N_DEFAULT_LANG=en',
    'I18N_FALLBACK_LANG=en',
  ]);
  upsertEnvLines(path.join(targetRoot, 'infra', 'docker', '.env.example'), [
    'I18N_DEFAULT_LANG=en',
    'I18N_FALLBACK_LANG=en',
  ]);

  patchCompose(targetRoot);
}
