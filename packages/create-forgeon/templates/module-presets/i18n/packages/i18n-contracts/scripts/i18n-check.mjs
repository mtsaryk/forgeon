import fs from 'node:fs';
import path from 'node:path';
import {
  fail,
  flattenKeys,
  getStructure,
  readGeneratedContracts,
  readJsonFile,
  resourcesRoot,
  sorted,
  success,
  warn,
} from './i18n-shared.mjs';

function diff(expected, actual) {
  return {
    missing: expected.filter((item) => !actual.includes(item)),
    extra: actual.filter((item) => !expected.includes(item)),
  };
}

function main() {
  const issues = [];
  const { locales, namespaces, fallbackLocale } = getStructure();
  const generated = readGeneratedContracts();

  const localeDiff = diff(locales, generated.locales);
  for (const item of localeDiff.missing) {
    issues.push(`[contracts] missing locale: ${item}`);
  }
  for (const item of localeDiff.extra) {
    issues.push(`[contracts] extra locale: ${item}`);
  }

  const namespaceDiff = diff(namespaces, generated.namespaces);
  for (const item of namespaceDiff.missing) {
    issues.push(`[contracts] missing namespace: ${item}`);
  }
  for (const item of namespaceDiff.extra) {
    issues.push(`[contracts] extra namespace: ${item}`);
  }

  const fallbackKeyMap = {};
  for (const namespace of namespaces) {
    const fallbackPath = path.join(resourcesRoot, fallbackLocale, `${namespace}.json`);
    try {
      const fallbackJson = readJsonFile(fallbackPath);
      fallbackKeyMap[namespace] = sorted(flattenKeys(fallbackJson));
    } catch (error) {
      issues.push(
        `[${fallbackLocale}] invalid JSON in ${namespace}.json: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  for (const locale of locales) {
    const localeDir = path.join(resourcesRoot, locale);
    const localeNamespaces = fs
      .readdirSync(localeDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name.slice(0, -5));

    const localeNamespaceDiff = diff(namespaces, sorted(localeNamespaces));
    for (const missingNamespace of localeNamespaceDiff.missing) {
      issues.push(`[${locale}] missing namespace file: ${missingNamespace}.json`);
    }
    for (const extraNamespace of localeNamespaceDiff.extra) {
      issues.push(`[${locale}] extra namespace file: ${extraNamespace}.json`);
    }

    for (const namespace of namespaces) {
      const localePath = path.join(localeDir, `${namespace}.json`);
      if (!fs.existsSync(localePath)) {
        continue;
      }

      let localeJson;
      try {
        localeJson = readJsonFile(localePath);
      } catch (error) {
        issues.push(
          `[${locale}] invalid JSON in ${namespace}.json: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }

      const localeKeys = sorted(flattenKeys(localeJson));
      const expectedKeys = fallbackKeyMap[namespace] ?? [];
      const keyDiff = diff(expectedKeys, localeKeys);

      for (const key of keyDiff.missing) {
        issues.push(`[${locale}] missing key in ${namespace}.json: ${key}`);
      }
      for (const key of keyDiff.extra) {
        issues.push(`[${locale}] extra key in ${namespace}.json: ${key}`);
      }
    }
  }

  if (issues.length > 0) {
    fail('i18n check failed.');
    for (const issue of issues) {
      fail(`- ${issue}`);
    }
    warn('Run `pnpm i18n:sync` if locales/namespaces changed.');
    process.exit(1);
  }

  success('i18n check passed.');
}

main();
