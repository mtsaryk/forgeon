import fs from 'node:fs';
import path from 'node:path';
import { removeIfExists } from '../utils/fs.mjs';

export function applyProxyPreset(targetRoot, proxy) {
  const dockerDir = path.join(targetRoot, 'infra', 'docker');
  const composeTarget = path.join(dockerDir, 'compose.yml');
  const composeSource = path.join(dockerDir, `compose.${proxy}.yml`);

  if (!fs.existsSync(composeSource)) {
    throw new Error(`Missing proxy compose preset: ${composeSource}`);
  }

  fs.copyFileSync(composeSource, composeTarget);

  removeIfExists(path.join(dockerDir, 'compose.nginx.yml'));
  removeIfExists(path.join(dockerDir, 'compose.caddy.yml'));
  removeIfExists(path.join(dockerDir, 'compose.none.yml'));

  if (proxy === 'nginx') {
    removeIfExists(path.join(dockerDir, 'caddy.Dockerfile'));
    removeIfExists(path.join(targetRoot, 'infra', 'caddy'));
  } else if (proxy === 'caddy') {
    removeIfExists(path.join(dockerDir, 'nginx.Dockerfile'));
    removeIfExists(path.join(targetRoot, 'infra', 'nginx'));
  } else if (proxy === 'none') {
    removeIfExists(path.join(dockerDir, 'nginx.Dockerfile'));
    removeIfExists(path.join(dockerDir, 'caddy.Dockerfile'));
    removeIfExists(path.join(targetRoot, 'infra', 'nginx'));
    removeIfExists(path.join(targetRoot, 'infra', 'caddy'));
  }
}
