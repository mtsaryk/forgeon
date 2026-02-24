export function parseAddCliArgs(argv) {
  const args = [...argv];
  const options = {
    moduleId: undefined,
    project: '.',
    list: false,
    help: false,
  };
  const positional = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--') continue;

    if (arg === '-h' || arg === '--help') {
      options.help = true;
      continue;
    }

    if (arg === '--list') {
      options.list = true;
      continue;
    }

    if (arg.startsWith('--project=')) {
      options.project = arg.split('=')[1] || '.';
      continue;
    }

    if (arg === '--project') {
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        options.project = args[i + 1];
        i += 1;
      }
      continue;
    }

    if (arg.startsWith('--')) {
      continue;
    }

    positional.push(arg);
  }

  if (positional.length > 0) {
    [options.moduleId] = positional;
  }

  if (positional.length > 1 && options.project === '.') {
    options.project = positional[1];
  }

  return options;
}
