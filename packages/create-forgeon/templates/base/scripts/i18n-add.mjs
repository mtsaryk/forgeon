import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const LOCALE_REGEX = /^[a-z]{2}(-[A-Z]{2})?$/;

function printUsage() {
  console.log('Usage: pnpm i18n:add <locale> [--copy-from=en] [--force] [--empty] [--no-sync]');
}

function parseArgs(argv) {
  const options = {
    locale: '',
    copyFrom: 'en',
    force: false,
    empty: false,
    noSync: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (arg === '--empty') {
      options.empty = true;
      continue;
    }
    if (arg === '--no-sync') {
      options.noSync = true;
      continue;
    }
    if (arg.startsWith('--copy-from=')) {
      options.copyFrom = arg.slice('--copy-from='.length).trim();
      continue;
    }
    if (arg === '--copy-from') {
      const next = argv[index + 1];
      if (!next || next.startsWith('-')) {
        throw new Error('Missing value for --copy-from.');
      }
      options.copyFrom = next.trim();
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (options.locale) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    options.locale = arg.trim();
  }

  return options;
}

function validateLocaleOrThrow(value, label) {
  if (!LOCALE_REGEX.test(value)) {
    throw new Error(`${label} must match ${LOCALE_REGEX}. Received: "${value}"`);
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listJsonFiles(folderPath) {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function runSyncCommand(cwd) {
  const command = 'pnpm i18n:sync';
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      stdio: 'inherit',
      shell: true,
    });
    child.on('error', (error) => reject(error));
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`"pnpm i18n:sync" failed with exit code ${code ?? 'unknown'}.`));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  if (!options.locale) {
    throw new Error('Locale is required.');
  }
  validateLocaleOrThrow(options.locale, 'Locale');
  validateLocaleOrThrow(options.copyFrom, 'copy-from');

  if (options.locale === options.copyFrom) {
    throw new Error('Locale must be different from --copy-from.');
  }

  const root = process.cwd();
  const resourcesRoot = path.join(root, 'resources', 'i18n');
  const sourceDir = path.join(resourcesRoot, options.copyFrom);
  const targetDir = path.join(resourcesRoot, options.locale);

  if (!(await pathExists(sourceDir))) {
    throw new Error(`Source locale folder not found: ${sourceDir}`);
  }

  const namespaceFiles = await listJsonFiles(sourceDir);
  if (namespaceFiles.length === 0) {
    throw new Error(`Source locale folder has no namespace JSON files: ${sourceDir}`);
  }

  const targetExisted = await pathExists(targetDir);
  await fs.mkdir(targetDir, { recursive: true });

  const conflictingFiles = [];
  for (const fileName of namespaceFiles) {
    const destinationPath = path.join(targetDir, fileName);
    if (await pathExists(destinationPath)) {
      conflictingFiles.push(fileName);
    }
  }

  if (conflictingFiles.length > 0 && !options.force) {
    throw new Error(
      `Target locale already has existing files: ${conflictingFiles.join(', ')}. Use --force to overwrite.`,
    );
  }

  const createdFiles = [];
  for (const fileName of namespaceFiles) {
    const sourcePath = path.join(sourceDir, fileName);
    const destinationPath = path.join(targetDir, fileName);
    let content = '{}\n';

    if (!options.empty) {
      content = await fs.readFile(sourcePath, 'utf8');
      if (!content.endsWith('\n')) {
        content = `${content}\n`;
      }
    }

    await fs.writeFile(destinationPath, content, 'utf8');
    createdFiles.push(fileName);
  }

  let syncExecuted = false;
  if (!options.noSync) {
    await runSyncCommand(root);
    syncExecuted = true;
  }

  console.log('i18n locale added successfully.');
  console.log(`- locale: ${options.locale}`);
  console.log(`- copy-from: ${options.copyFrom}`);
  console.log(`- folder: ${path.join('resources', 'i18n', options.locale)} (${targetExisted ? 'existing' : 'created'})`);
  console.log(`- files: ${createdFiles.length} (${options.empty ? 'empty {}' : 'copied'})`);
  for (const fileName of createdFiles) {
    console.log(`  - ${fileName}`);
  }
  console.log(`- sync: ${syncExecuted ? 'pnpm i18n:sync executed' : 'skipped (--no-sync)'}`);
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  printUsage();
  process.exitCode = 1;
});
