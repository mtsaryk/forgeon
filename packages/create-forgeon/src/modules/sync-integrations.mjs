import fs from 'node:fs';
import path from 'node:path';

const ACCOUNTS_RBAC_MARKERS = {
  start: '<!-- forgeon:accounts:rbac:start -->',
  end: '<!-- forgeon:accounts:rbac:end -->',
};

const ACCOUNTS_RBAC_ENABLED_BLOCK =
  '- RBAC compatibility sync: contracts and JWT payload surfaces are prepared for optional RBAC claims, while the base accounts schema remains free of roles and permissions.';

const INTEGRATION_GROUPS = [
  {
    id: 'accounts-rbac',
    title: 'Accounts RBAC Compatibility Sync',
    participants: ['accounts', 'rbac'],
    relatedModules: ['accounts', 'rbac'],
    description: [
      'Add optional roles and permissions fields to accounts auth claims types',
      'Keep the base accounts schema unchanged while exposing a compatibility seam for future RBAC claims providers',
      'Update the generated README managed note for accounts + rbac compatibility',
    ],
    isAvailable: (detected) => detected.accounts && detected.rbac,
    isPending: (rootDir) => isAccountsRbacPending(rootDir),
    apply: syncAccountsRbacCompatibility,
  },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceReadmeManagedBlock(content, startMarker, endMarker, nextBody) {
  const pattern = new RegExp(`${escapeRegExp(startMarker)}\\n[\\s\\S]*?\\n${escapeRegExp(endMarker)}`);
  if (!pattern.test(content)) {
    return content;
  }
  return content.replace(pattern, `${startMarker}\n${nextBody}\n${endMarker}`);
}

function detectModules(rootDir) {
  const appModulePath = path.join(rootDir, 'apps', 'api', 'src', 'app.module.ts');
  const appModuleText = fs.existsSync(appModulePath) ? fs.readFileSync(appModulePath, 'utf8') : '';

  return {
    accounts:
      fs.existsSync(path.join(rootDir, 'packages', 'accounts-api', 'package.json')) ||
      appModuleText.includes("from '@forgeon/accounts-api'"),
    rbac:
      fs.existsSync(path.join(rootDir, 'packages', 'rbac', 'package.json')) ||
      appModuleText.includes("from '@forgeon/rbac'"),
  };
}

function isAccountsRbacPending(rootDir) {
  const contractsPath = path.join(rootDir, 'packages', 'accounts-contracts', 'src', 'index.ts');
  const authTypesPath = path.join(rootDir, 'packages', 'accounts-api', 'src', 'auth.types.ts');
  const readmePath = path.join(rootDir, 'README.md');

  if (!fs.existsSync(contractsPath) || !fs.existsSync(authTypesPath) || !fs.existsSync(readmePath)) {
    return false;
  }

  const contracts = fs.readFileSync(contractsPath, 'utf8');
  const authTypes = fs.readFileSync(authTypesPath, 'utf8');
  const readme = fs.readFileSync(readmePath, 'utf8');

  const contractsReady =
    contracts.includes('roles?: string[];') &&
    contracts.includes('permissions?: string[];');
  const authTypesReady =
    authTypes.includes('roles?: string[];') &&
    authTypes.includes('permissions?: string[];');
  const readmeReady = readme.includes(ACCOUNTS_RBAC_ENABLED_BLOCK);

  return !(contractsReady && authTypesReady && readmeReady);
}

function syncAccountsRbacCompatibility({ rootDir, changedFiles }) {
  const contractsPath = path.join(rootDir, 'packages', 'accounts-contracts', 'src', 'index.ts');
  const authTypesPath = path.join(rootDir, 'packages', 'accounts-api', 'src', 'auth.types.ts');
  const readmePath = path.join(rootDir, 'README.md');

  if (!fs.existsSync(contractsPath) || !fs.existsSync(authTypesPath) || !fs.existsSync(readmePath)) {
    return { applied: false, reason: 'accounts package files are missing' };
  }

  let touched = false;

  let contracts = fs.readFileSync(contractsPath, 'utf8').replace(/\r\n/g, '\n');
  const originalContracts = contracts;
  if (!contracts.includes('roles?: string[];')) {
    contracts = contracts.replace(
      "  type: 'access';",
      "  type: 'access';\n  roles?: string[];\n  permissions?: string[];",
    );
  }
  if (!contracts.includes("jti: string;\n  type: 'refresh';\n  roles?: string[];")) {
    contracts = contracts.replace(
      "  jti: string;\n  type: 'refresh';",
      "  jti: string;\n  type: 'refresh';\n  roles?: string[];\n  permissions?: string[];",
    );
  }
  if (contracts !== originalContracts) {
    fs.writeFileSync(contractsPath, `${contracts.trimEnd()}\n`, 'utf8');
    changedFiles.add(contractsPath);
    touched = true;
  }

  let authTypes = fs.readFileSync(authTypesPath, 'utf8').replace(/\r\n/g, '\n');
  const originalAuthTypes = authTypes;
  if (!authTypes.includes('roles?: string[];')) {
    authTypes = authTypes.replace(
      "  exp?: number;",
      "  exp?: number;\n  roles?: string[];\n  permissions?: string[];",
    );
  }
  const refreshPattern = /export interface AuthRefreshTokenPayload[\s\S]*?\{[\s\S]*?exp\?: number;[\s\S]*?\}/m;
  const refreshMatch = authTypes.match(refreshPattern)?.[0] ?? '';
  if (refreshMatch && !refreshMatch.includes('roles?: string[];')) {
    authTypes = authTypes.replace(
      "export interface AuthRefreshTokenPayload extends AuthRefreshClaims {\n  iat?: number;\n  exp?: number;\n}",
      "export interface AuthRefreshTokenPayload extends AuthRefreshClaims {\n  iat?: number;\n  exp?: number;\n  roles?: string[];\n  permissions?: string[];\n}",
    );
  }
  if (authTypes !== originalAuthTypes) {
    fs.writeFileSync(authTypesPath, `${authTypes.trimEnd()}\n`, 'utf8');
    changedFiles.add(authTypesPath);
    touched = true;
  }

  let readme = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  const originalReadme = readme;
  readme = replaceReadmeManagedBlock(
    readme,
    ACCOUNTS_RBAC_MARKERS.start,
    ACCOUNTS_RBAC_MARKERS.end,
    ACCOUNTS_RBAC_ENABLED_BLOCK,
  );
  if (readme !== originalReadme) {
    fs.writeFileSync(readmePath, `${readme.trimEnd()}\n`, 'utf8');
    changedFiles.add(readmePath);
    touched = true;
  }

  if (!touched) {
    return { applied: false, reason: 'already synced' };
  }
  return { applied: true };
}

function getGroupParticipants(group) {
  return Array.isArray(group.participants) ? group.participants : [];
}

function getGroupRelatedModules(group) {
  return Array.isArray(group.relatedModules) ? group.relatedModules : getGroupParticipants(group);
}

export function syncIntegrations({ targetRoot, groupIds = null }) {
  const rootDir = path.resolve(targetRoot);
  const changedFiles = new Set();
  const detected = detectModules(rootDir);
  const available = INTEGRATION_GROUPS.filter(
    (group) => group.isAvailable(detected) && group.isPending(rootDir),
  );
  const selected = Array.isArray(groupIds)
    ? available.filter((group) => groupIds.includes(group.id))
    : available;

  const summary = selected.map((group) => ({
    id: group.id,
    title: group.title,
    modules: [...getGroupParticipants(group)],
    result: group.apply({ rootDir, changedFiles }),
  }));

  return {
    summary,
    availableGroups: available.map((group) => ({
      id: group.id,
      title: group.title,
      modules: [...getGroupParticipants(group)],
      description: [...group.description],
    })),
    changedFiles: [...changedFiles].sort().map((filePath) => path.relative(rootDir, filePath)),
  };
}

export function scanIntegrations({ targetRoot, relatedModuleId = null }) {
  const rootDir = path.resolve(targetRoot);
  const detected = detectModules(rootDir);
  const groups = INTEGRATION_GROUPS.filter(
    (group) =>
      group.isAvailable(detected) &&
      group.isPending(rootDir) &&
      (!relatedModuleId || getGroupRelatedModules(group).includes(relatedModuleId)),
  );

  return {
    groups: groups.map((group) => ({
      id: group.id,
      title: group.title,
      modules: [...getGroupParticipants(group)],
      description: [...group.description],
    })),
  };
}
