import fs from 'node:fs';
import path from 'node:path';
import { getDatabaseLabel } from '../databases/index.mjs';
import { getFrontendLabel } from '../frameworks/index.mjs';
import { getProxyConfigPath } from '../infrastructure/proxy.mjs';

function renderTemplate(content, variables) {
  return content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => String(variables[key] ?? ''));
}

function readFragment(fragmentsRoot, docKey, fragmentName, variables) {
  const fragmentPath = path.join(fragmentsRoot, docKey, `${fragmentName}.md`);
  if (!fs.existsSync(fragmentPath)) {
    throw new Error(`Missing docs fragment: ${fragmentPath}`);
  }

  const raw = fs.readFileSync(fragmentPath, 'utf8').replace(/\r\n/g, '\n').trim();
  return renderTemplate(raw, variables).trim();
}

function writeDocFromFragments({
  targetRoot,
  outputPath,
  fragmentsRoot,
  docKey,
  fragmentNames,
  variables,
}) {
  const fragments = fragmentNames
    .map((fragmentName) => readFragment(fragmentsRoot, docKey, fragmentName, variables))
    .filter((fragment) => fragment.length > 0);

  const content = `${fragments
    .join('\n\n')
    .replace(/\n{2,}(?=- )/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`;
  const absoluteOutputPath = path.join(targetRoot, outputPath);
  fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  fs.writeFileSync(absoluteOutputPath, content, 'utf8');
}

export function generateDocs(targetRoot, options, packageRoot) {
  const fragmentsRoot = path.resolve(packageRoot, 'templates', 'docs-fragments');
  const variables = {
    FRONTEND_LABEL: getFrontendLabel(options.frontend),
    DB_LABEL: getDatabaseLabel(options.db),
    I18N_STATUS: options.i18nEnabled ? 'enabled' : 'disabled',
    DOCKER_STATUS: 'enabled',
    PROXY_LABEL: options.proxy,
    PROXY_CONFIG_PATH: getProxyConfigPath(options.proxy),
  };

  const readmeFragments = ['00_title', '10_stack', '20_quick_start_dev_intro'];
  readmeFragments.push('21_quick_start_dev_db_docker');
  readmeFragments.push('22_quick_start_dev_outro');
  readmeFragments.push(
    options.proxy === 'none' ? '30_quick_start_docker_none' : '30_quick_start_docker',
  );
  if (options.proxy === 'caddy') {
    readmeFragments.push('31_proxy_preset_caddy');
  } else if (options.proxy === 'nginx') {
    readmeFragments.push('31_proxy_preset_nginx');
  } else {
    readmeFragments.push('31_proxy_preset_none');
  }
  readmeFragments.push('32_prisma_container_start');
  if (options.i18nEnabled) {
    readmeFragments.push('40_i18n');
  }
  readmeFragments.push('90_next_steps');

  const aiProjectFragments = ['00_title', '10_what_is', '20_structure_base'];
  if (options.i18nEnabled) {
    aiProjectFragments.push('21_structure_i18n');
  }
  aiProjectFragments.push('22_structure_docker', '23_structure_docs', '30_run_dev', '31_run_docker');
  if (options.proxy === 'none') {
    aiProjectFragments.push('32_proxy_notes_none');
  } else {
    aiProjectFragments.push('32_proxy_notes');
  }
  if (options.i18nEnabled) {
    aiProjectFragments.push('33_i18n_notes');
  }
  aiProjectFragments.push('40_change_boundaries_base');
  if (options.proxy !== 'none') {
    aiProjectFragments.push('41_change_boundaries_docker');
  }

  const aiArchitectureFragments = ['00_title', '10_layout_base', '11_layout_infra'];
  if (options.i18nEnabled) {
    aiArchitectureFragments.push('12_layout_i18n_resources');
  }
  aiArchitectureFragments.push('20_env_base');
  if (options.i18nEnabled) {
    aiArchitectureFragments.push('21_env_i18n');
  }
  aiArchitectureFragments.push('30_default_db', '31_docker_runtime', '32_scope_freeze');
  aiArchitectureFragments.push('40_docs_generation', '50_extension_points');

  writeDocFromFragments({
    targetRoot,
    outputPath: 'README.md',
    fragmentsRoot,
    docKey: 'README',
    fragmentNames: readmeFragments,
    variables,
  });

  writeDocFromFragments({
    targetRoot,
    outputPath: path.join('docs', 'AI', 'PROJECT.md'),
    fragmentsRoot,
    docKey: 'AI_PROJECT',
    fragmentNames: aiProjectFragments,
    variables,
  });

  writeDocFromFragments({
    targetRoot,
    outputPath: path.join('docs', 'AI', 'ARCHITECTURE.md'),
    fragmentsRoot,
    docKey: 'AI_ARCHITECTURE',
    fragmentNames: aiArchitectureFragments,
    variables,
  });
}
