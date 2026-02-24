import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { DEFAULT_OPTIONS, DEFAULT_PROXY } from '../constants.mjs';
import { promptSelect } from './prompt-select.mjs';

const REMOVED_FLAGS = new Set(['frontend', 'db', 'docker']);

export function parseCliArgs(argv) {
  const args = [...argv];
  const options = { ...DEFAULT_OPTIONS };
  const positional = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--') continue;

    if (arg === '-h' || arg === '--help') {
      options.help = true;
      continue;
    }

    if (arg === '-y' || arg === '--yes') {
      options.yes = true;
      continue;
    }

    if (arg === '--install') {
      options.install = true;
      continue;
    }

    if (arg.startsWith('--no-')) {
      const key = arg.slice(5);
      if (REMOVED_FLAGS.has(key)) {
        throw new Error(`Option "--${key}" has been removed. Forgeon now uses a fixed stack.`);
      }
      if (key === 'install') options.install = false;
      if (key === 'i18n') options.i18n = false;
      continue;
    }

    if (arg.startsWith('--')) {
      const [keyRaw, inlineValue] = arg.split('=');
      const key = keyRaw.slice(2);
      if (REMOVED_FLAGS.has(key)) {
        throw new Error(`Option "--${key}" has been removed. Forgeon now uses a fixed stack.`);
      }

      let value = inlineValue;
      if (value === undefined && args[i + 1] && !args[i + 1].startsWith('-')) {
        value = args[i + 1];
        i += 1;
      }

      if (Object.prototype.hasOwnProperty.call(options, key)) {
        options[key] = value;
      }

      continue;
    }

    positional.push(arg);
  }

  return { options, positional };
}

export async function promptForMissingOptions(options) {
  const nextOptions = { ...options };

  if (!nextOptions.name) {
    if (!input.isTTY) {
      throw new Error('Project name is required in non-interactive mode. Pass it as first argument.');
    }

    const rl = readline.createInterface({ input, output });
    try {
      nextOptions.name = await rl.question('Project name: ');
    } finally {
      await rl.close();
    }
  }

  if (!nextOptions.yes && nextOptions.i18n === undefined) {
    nextOptions.i18n = await promptSelect({
      message: 'Enable i18n:',
      defaultValue: 'true',
      choices: [
        { label: 'true', value: 'true' },
        { label: 'false', value: 'false' },
      ],
    });
  }

  if (!nextOptions.yes && !nextOptions.proxy) {
    nextOptions.proxy = await promptSelect({
      message: 'Reverse proxy preset:',
      defaultValue: DEFAULT_PROXY,
      choices: [
        { label: 'caddy', value: 'caddy' },
        { label: 'nginx', value: 'nginx' },
        { label: 'none', value: 'none' },
      ],
    });
  }

  if (nextOptions.yes) {
    if (nextOptions.i18n === undefined) nextOptions.i18n = 'true';
    if (!nextOptions.proxy) nextOptions.proxy = DEFAULT_PROXY;
  }

  if (nextOptions.i18n === undefined) {
    nextOptions.i18n = 'true';
  }
  if (!nextOptions.proxy) {
    nextOptions.proxy = DEFAULT_PROXY;
  }

  return nextOptions;
}
