import fs from 'node:fs';
import path from 'node:path';

function renderTemplate(content, variables) {
  return content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => String(variables[key] ?? ''));
}

function readModuleFragment(packageRoot, moduleId, fragmentName, variables) {
  const fragmentPath = path.join(
    packageRoot,
    'templates',
    'module-fragments',
    moduleId,
    `${fragmentName}.md`,
  );
  if (!fs.existsSync(fragmentPath)) {
    throw new Error(`Missing module docs fragment: ${fragmentPath}`);
  }
  const raw = fs.readFileSync(fragmentPath, 'utf8').replace(/\r\n/g, '\n').trim();
  return renderTemplate(raw, variables).trim();
}

function ensureModuleIndex(targetRoot) {
  const indexPath = path.join(targetRoot, 'docs', 'AI', 'MODULES', 'README.md');
  if (!fs.existsSync(indexPath)) {
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(
      indexPath,
      '# MODULES\n\nGenerated notes for module presets added via `create-forgeon add`.\n',
      'utf8',
    );
  }
  return indexPath;
}

function updateModuleIndex(indexPath, preset) {
  const relativePath = `${preset.id}.md`;
  const nextLine = `- \`${preset.id}\` - ${preset.label} (${preset.implemented ? 'implemented' : 'planned'})`;
  const current = fs.readFileSync(indexPath, 'utf8').replace(/\r\n/g, '\n');

  if (current.includes(`\`${preset.id}\``)) {
    return;
  }

  const content = `${current.trimEnd()}\n${nextLine}\n`;
  fs.writeFileSync(indexPath, content, 'utf8');
}

export function writeModuleDocs({ packageRoot, targetRoot, preset }) {
  const variables = {
    MODULE_ID: preset.id,
    MODULE_LABEL: preset.label,
    MODULE_CATEGORY: preset.category,
    MODULE_STATUS: preset.implemented ? 'implemented' : 'planned',
    MODULE_DESCRIPTION: preset.description,
  };

  const sections = preset.docFragments
    .map((fragmentName) => readModuleFragment(packageRoot, preset.id, fragmentName, variables))
    .filter(Boolean);

  const outputPath = path.join(targetRoot, 'docs', 'AI', 'MODULES', `${preset.id}.md`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${sections.join('\n\n').trimEnd()}\n`, 'utf8');

  const indexPath = ensureModuleIndex(targetRoot);
  updateModuleIndex(indexPath, preset);

  return outputPath;
}
