import fs from 'node:fs';
import path from 'node:path';
import { getDatabaseLabel } from '../databases/index.mjs';
import { getFrontendLabel } from '../frameworks/index.mjs';

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
  const dbLabel = options.dbPrismaEnabled ? getDatabaseLabel(options.db) : 'none (add db-prisma later)';
  const variables = {
    FRONTEND_LABEL: getFrontendLabel(options.frontend),
    DB_LABEL: dbLabel,
    I18N_STATUS: options.i18nEnabled ? 'enabled' : 'disabled',
    DB_PRISMA_STATUS: options.dbPrismaEnabled ? 'enabled' : 'disabled',
    DOCKER_STATUS: 'enabled',
    PROXY_LABEL: options.proxy,
  };

  const readmeFragments = ['00_title', '10_stack', '20_quick_start_dev_intro'];
  if (options.dbPrismaEnabled) {
    readmeFragments.push('21_quick_start_dev_db_docker');
  } else {
    readmeFragments.push('21_quick_start_dev_no_db');
  }
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
  if (options.dbPrismaEnabled) {
    readmeFragments.push('32_prisma_container_start');
  }
  if (options.i18nEnabled) {
    readmeFragments.push('40_i18n');
  }
  readmeFragments.push('41_error_handling');
  readmeFragments.push('90_next_steps');

  writeDocFromFragments({
    targetRoot,
    outputPath: 'README.md',
    fragmentsRoot,
    docKey: 'README',
    fragmentNames: readmeFragments,
    variables,
  });
}
