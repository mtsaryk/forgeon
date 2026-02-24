import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { printAddHelp } from './cli/add-help.mjs';
import { parseAddCliArgs } from './cli/add-options.mjs';
import { addModule } from './modules/executor.mjs';
import { listModulePresets } from './modules/registry.mjs';

function printModuleList() {
  const modules = listModulePresets();
  console.log('Available modules:');
  for (const moduleItem of modules) {
    const status = moduleItem.implemented ? 'implemented' : 'planned';
    console.log(`- ${moduleItem.id} (${status}) - ${moduleItem.description}`);
  }
}

export async function runAddModule(argv = process.argv.slice(2)) {
  const options = parseAddCliArgs(argv);

  if (options.help) {
    printAddHelp();
    return;
  }

  if (options.list) {
    printModuleList();
    return;
  }

  if (!options.moduleId) {
    throw new Error('Module id is required. Use `create-forgeon add --list` to see available modules.');
  }

  const srcDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(srcDir, '..');
  const targetRoot = path.resolve(process.cwd(), options.project);

  const result = addModule({
    moduleId: options.moduleId,
    targetRoot,
    packageRoot,
  });

  console.log(result.message);
  console.log(`- module: ${result.preset.id}`);
  console.log(`- docs: ${result.docsPath}`);
}
