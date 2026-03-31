#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ACCOUNTS_RBAC_MARKERS = {
  start: '<!-- forgeon:accounts:rbac:start -->',
  end: '<!-- forgeon:accounts:rbac:end -->',
};

const ACCOUNTS_RBAC_ENABLED_BLOCK =
  '- RBAC compatibility sync: contracts and JWT payload surfaces are prepared for optional RBAC claims, while the base accounts schema remains free of roles and permissions.';

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

function syncAccountsRbac(rootDir, changedFiles) {
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
  if (authTypes.includes('export interface AuthRefreshTokenPayload extends AuthRefreshClaims {') && !authTypes.includes("AuthRefreshTokenPayload extends AuthRefreshClaims {\n  iat?: number;\n  exp?: number;\n  roles?: string[];")) {
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

function run() {
  const rootDir = process.cwd();
  const detected = detectModules(rootDir);
  const changedFiles = new Set();
  const summary = [];

  if (detected.accounts && detected.rbac) {
    summary.push({
      feature: 'accounts + rbac',
      result: syncAccountsRbac(rootDir, changedFiles),
    });
  } else {
    summary.push({
      feature: 'accounts + rbac',
      result: { applied: false, reason: 'required components are not both available' },
    });
  }

  console.log('[forgeon:sync-integrations] done');
  for (const item of summary) {
    if (item.result.applied) {
      console.log(`- ${item.feature}: applied`);
    } else {
      console.log(`- ${item.feature}: skipped (${item.result.reason})`);
    }
  }

  if (changedFiles.size > 0) {
    console.log('- changed files:');
    for (const filePath of [...changedFiles].sort()) {
      console.log(`  - ${path.relative(rootDir, filePath)}`);
    }
  }
}

run();
