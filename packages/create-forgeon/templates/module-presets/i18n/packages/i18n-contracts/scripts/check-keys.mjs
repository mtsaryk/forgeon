import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const resourcesRoot = path.join(projectRoot, 'resources', 'i18n');
const baseLocale = 'en';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function flattenKeys(value, prefix = '') {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    return prefix ? [prefix] : [];
  }

  const result = [];
  for (const [key, nested] of entries) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    result.push(...flattenKeys(nested, nextPrefix));
  }
  return result;
}

function sorted(array) {
  return [...array].sort((a, b) => a.localeCompare(b));
}

function main() {
  if (!fs.existsSync(resourcesRoot)) {
    console.error(`Missing resources folder: ${resourcesRoot}`);
    process.exit(1);
  }

  const localeDirs = fs
    .readdirSync(resourcesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  if (!localeDirs.includes(baseLocale)) {
    console.error(`Missing base locale "${baseLocale}" in ${resourcesRoot}`);
    process.exit(1);
  }

  const baseLocaleDir = path.join(resourcesRoot, baseLocale);
  const baseFiles = fs
    .readdirSync(baseLocaleDir)
    .filter((name) => name.endsWith('.json'));

  const errors = [];

  for (const locale of localeDirs) {
    const localeDir = path.join(resourcesRoot, locale);
    for (const fileName of baseFiles) {
      const baseFilePath = path.join(baseLocaleDir, fileName);
      const localeFilePath = path.join(localeDir, fileName);

      if (!fs.existsSync(localeFilePath)) {
        errors.push(`[${locale}] missing file: ${fileName}`);
        continue;
      }

      const baseKeys = sorted(flattenKeys(readJson(baseFilePath)));
      const localeKeys = sorted(flattenKeys(readJson(localeFilePath)));

      const missingKeys = baseKeys.filter((key) => !localeKeys.includes(key));
      const extraKeys = localeKeys.filter((key) => !baseKeys.includes(key));

      for (const key of missingKeys) {
        errors.push(`[${locale}] missing key in ${fileName}: ${key}`);
      }
      for (const key of extraKeys) {
        errors.push(`[${locale}] extra key in ${fileName}: ${key}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('i18n key check failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('i18n key check passed.');
}

main();
