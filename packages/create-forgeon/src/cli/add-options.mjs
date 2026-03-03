export function parseAddCliArgs(argv) {
  const args = [...argv];
  const options = {
    moduleId: undefined,
    project: '.',
    list: false,
    help: false,
    withRequired: false,
    providers: {},
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

    if (arg === '--with-required') {
      options.withRequired = true;
      continue;
    }

    if (arg.startsWith('--provider=')) {
      const raw = arg.slice('--provider='.length);
      const separatorIndex = raw.indexOf('=');
      if (separatorIndex > 0) {
        const capabilityId = raw.slice(0, separatorIndex).trim();
        const moduleId = raw.slice(separatorIndex + 1).trim();
        if (capabilityId && moduleId) {
          options.providers[capabilityId] = moduleId;
        }
      }
      continue;
    }

    if (arg === '--provider') {
      const nextValue = args[i + 1];
      if (nextValue && !nextValue.startsWith('-')) {
        const separatorIndex = nextValue.indexOf('=');
        if (separatorIndex > 0) {
          const capabilityId = nextValue.slice(0, separatorIndex).trim();
          const moduleId = nextValue.slice(separatorIndex + 1).trim();
          if (capabilityId && moduleId) {
            options.providers[capabilityId] = moduleId;
          }
        }
        i += 1;
      }
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
