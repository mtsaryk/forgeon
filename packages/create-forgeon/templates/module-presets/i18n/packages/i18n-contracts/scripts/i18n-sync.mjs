import {
  generatedPath,
  getStructure,
  info,
  renderGeneratedContracts,
  success,
  writeTextFile,
} from './i18n-shared.mjs';

function main() {
  const { locales, namespaces, fallbackLocale } = getStructure();
  writeTextFile(generatedPath, renderGeneratedContracts({ locales, namespaces }));
  success('i18n contracts synced.');
  info(`- fallback locale: ${fallbackLocale}`);
  info(`- locales: ${locales.join(', ')}`);
  info(`- namespaces: ${namespaces.join(', ')}`);
}

main();
