import fs from 'node:fs';
import path from 'node:path';
import { readJson } from '../../utils/fs.mjs';

const ansi = {
  reset: '\x1b[0m',
  yellow: '\x1b[33m',
};

const MODULE_PROBES_START = '  // forgeon:module-probes:start';
const MODULE_PROBES_END = '  // forgeon:module-probes:end';
const probeEntryPattern = /  \/\/ forgeon:probe:([a-z0-9-]+):start\n([\s\S]*?)\n  \/\/ forgeon:probe:\1:end/g;

const probeOrders = {
  health: 10,
  error: 20,
  validation: 30,
  db: 40,
  auth: 50,
  rbac: 60,
  'rate-limit': 70,
  files: 80,
  'files-variants': 81,
  'files-access': 82,
  'files-quotas': 83,
  'files-image': 84,
  queue: 90,
  scheduler: 100,
};


function colorize(text) {
  return `${ansi.yellow}${text}${ansi.reset}`;
}

function warn(moduleId, message) {
  console.log(colorize(`[forgeon:probes] ${moduleId}: ${message}`));
}

function normalize(content) {
  return content.replace(/\r\n/g, '\n');
}

function hasProbeContainer(content) {
  return /id=(['"])probes\1/.test(content);
}

function getPackageJson(targetRoot) {
  const packagePath = path.join(targetRoot, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return {};
  }

  return readJson(packagePath);
}

function getWebRegistryPath(targetRoot) {
  return path.join(targetRoot, 'apps', 'web', 'src', 'probes.ts');
}

function getModuleProbeEntries(content) {
  const entries = new Map();
  for (const match of content.matchAll(probeEntryPattern)) {
    const probeId = match[1];
    const jsonBlock = match[2].trim().replace(/,\s*$/, '');
    try {
      entries.set(probeId, JSON.parse(jsonBlock));
    } catch {
      continue;
    }
  }
  return entries;
}

function formatEntry(definition) {
  const jsonBlock = JSON.stringify(definition, null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

  return `  // forgeon:probe:${definition.id}:start\n${jsonBlock},\n  // forgeon:probe:${definition.id}:end`;
}

function replaceManagedBlock(content, entries) {
  const sortedDefinitions = [...entries.values()].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.id.localeCompare(right.id);
  });

  const body = sortedDefinitions.map((definition) => formatEntry(definition)).join('\n\n');
  const nextBlock = body.length > 0
    ? `${MODULE_PROBES_START}\n${body}\n${MODULE_PROBES_END}`
    : `${MODULE_PROBES_START}\n${MODULE_PROBES_END}`;

  const blockPattern = new RegExp(
    `${escapeRegExp(MODULE_PROBES_START)}(?:\\n[\\s\\S]*?)?\\n${escapeRegExp(MODULE_PROBES_END)}`,
  );

  if (!blockPattern.test(content)) {
    return content;
  }

  return content.replace(blockPattern, nextBlock);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getProbeOrder(probeId) {
  return probeOrders[probeId] ?? 999;
}

export function resolveProbeTargets({ targetRoot, moduleId }) {
  const packageJson = getPackageJson(targetRoot);
  const probesEnabled = packageJson.forgeon?.diagnostics?.probes?.enabled !== false;
  if (!probesEnabled) {
    warn(moduleId, 'probe wiring skipped because forgeon.diagnostics.probes.enabled=false.');
    return {
      allowApi: false,
      allowWeb: false,
      reason: 'disabled-by-config',
    };
  }

  const healthControllerPath = path.join(targetRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts');
  if (!fs.existsSync(healthControllerPath)) {
    warn(moduleId, 'probe wiring skipped because apps/api/src/health/health.controller.ts is missing.');
    return {
      allowApi: false,
      allowWeb: false,
      reason: 'missing-health-surface',
    };
  }

  const webAppPath = path.join(targetRoot, 'apps', 'web', 'src', 'App.tsx');
  if (!fs.existsSync(webAppPath)) {
    warn(moduleId, 'web probe skipped because apps/web/src/App.tsx is missing.');
    return {
      allowApi: true,
      allowWeb: false,
      reason: 'missing-web-app',
      healthControllerPath,
    };
  }

  const webAppContent = normalize(fs.readFileSync(webAppPath, 'utf8'));
  if (!hasProbeContainer(webAppContent)) {
    warn(moduleId, 'web probe skipped because App.tsx does not expose a #probes container.');
    return {
      allowApi: true,
      allowWeb: false,
      reason: 'missing-web-probes-container',
      healthControllerPath,
      webAppPath,
    };
  }

  const probesFilePath = getWebRegistryPath(targetRoot);
  if (!fs.existsSync(probesFilePath)) {
    warn(moduleId, 'web probe skipped because apps/web/src/probes.ts is missing.');
    return {
      allowApi: true,
      allowWeb: false,
      reason: 'missing-web-probes-registry',
      healthControllerPath,
      webAppPath,
    };
  }

  const probesContent = normalize(fs.readFileSync(probesFilePath, 'utf8'));
  if (!probesContent.includes(MODULE_PROBES_START) || !probesContent.includes(MODULE_PROBES_END)) {
    warn(moduleId, 'web probe skipped because apps/web/src/probes.ts is missing managed module markers.');
    return {
      allowApi: true,
      allowWeb: false,
      reason: 'missing-web-probes-markers',
      healthControllerPath,
      webAppPath,
      probesFilePath,
    };
  }

  return {
    allowApi: true,
    allowWeb: true,
    reason: 'ready',
    healthControllerPath,
    webAppPath,
    probesFilePath,
  };
}

export function ensureWebProbeDefinition({ targetRoot, probeTargets, definition }) {
  if (!probeTargets?.allowWeb) {
    return false;
  }

  const probesFilePath = probeTargets.probesFilePath ?? getWebRegistryPath(targetRoot);
  if (!fs.existsSync(probesFilePath)) {
    return false;
  }

  const normalizedDefinition = {
    ...definition,
    order: definition.order ?? getProbeOrder(definition.id),
  };

  const content = normalize(fs.readFileSync(probesFilePath, 'utf8'));
  const entries = getModuleProbeEntries(content);
  entries.set(normalizedDefinition.id, normalizedDefinition);

  const nextContent = replaceManagedBlock(content, entries);
  fs.writeFileSync(probesFilePath, `${nextContent.trimEnd()}\n`, 'utf8');
  return true;
}

export function readManagedWebProbeDefinitions(targetRoot) {
  const probesFilePath = getWebRegistryPath(targetRoot);
  if (!fs.existsSync(probesFilePath)) {
    return [];
  }

  const content = normalize(fs.readFileSync(probesFilePath, 'utf8'));
  return [...getModuleProbeEntries(content).values()].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.id.localeCompare(right.id);
  });
}


