import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { printHelp } from './cli/help.mjs';
import { parseCliArgs, promptForMissingOptions } from './cli/options.mjs';
import { DEFAULT_DB, DEFAULT_FRONTEND, DEFAULT_PROXY, FIXED_DOCKER_ENABLED } from './constants.mjs';
import { runInstall } from './core/install.mjs';
import { scaffoldProject } from './core/scaffold.mjs';
import { validatePresetSupport } from './core/validate.mjs';
import { parseBoolean } from './utils/values.mjs';

export async function runCreateForgeon(argv = process.argv.slice(2)) {
  const { options: parsedOptions, positional } = parseCliArgs(argv);
  const options = { ...parsedOptions };

  if (options.help) {
    printHelp();
    return;
  }

  if (!options.name && positional.length > 0) {
    [options.name] = positional;
  }

  const promptedOptions = await promptForMissingOptions(options);

  if (!promptedOptions.name || promptedOptions.name.trim().length === 0) {
    throw new Error('Project name is required.');
  }

  const frontend = (promptedOptions.frontend ?? DEFAULT_FRONTEND).toString().toLowerCase();
  const db = (promptedOptions.db ?? DEFAULT_DB).toString().toLowerCase();
  const i18nEnabled = parseBoolean(promptedOptions.i18n, true);
  const dockerEnabled = FIXED_DOCKER_ENABLED;
  const proxy = (promptedOptions.proxy ?? DEFAULT_PROXY).toString().toLowerCase();
  const installEnabled = parseBoolean(promptedOptions.install, false);

  validatePresetSupport({ frontend, db, dockerEnabled, proxy });

  const projectName = promptedOptions.name.trim();
  const targetRoot = path.resolve(process.cwd(), projectName);
  if (fs.existsSync(targetRoot)) {
    throw new Error(`Target directory already exists: ${targetRoot}`);
  }

  const srcDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(srcDir, '..');
  const templateRoot = path.join(packageRoot, 'templates', 'base');

  scaffoldProject({
    templateRoot,
    packageRoot,
    targetRoot,
    projectName,
    frontend,
    db,
    i18nEnabled,
    proxy,
  });

  if (installEnabled) {
    runInstall(targetRoot);
  }

  console.log('Forgeon scaffold generated.');
  console.log(`- path: ${targetRoot}`);
  console.log(`- frontend: ${frontend}`);
  console.log(`- db: ${db}`);
  console.log(`- i18n: ${i18nEnabled}`);
  console.log(`- docker: ${dockerEnabled}`);
  console.log(`- proxy: ${proxy}`);
}
