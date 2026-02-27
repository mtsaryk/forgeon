import { promptSelect } from '../cli/prompt-select.mjs';
import { scanIntegrations, syncIntegrations } from '../modules/sync-integrations.mjs';

const ansi = {
  reset: '\x1b[0m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function colorize(color, text) {
  return `${ansi[color]}${text}${ansi.reset}`;
}

function printGroup(group) {
  console.log(`\n${colorize('yellow', `▶ ${group.title}`)}`);
  group.modules.forEach((moduleId, index) => {
    const branch = index === group.modules.length - 1 ? '└─' : '├─';
    console.log(`   ${branch} ${colorize('cyan', moduleId)}`);
  });
  console.log('   This will:');
  for (const line of group.description) {
    console.log(`   • ${line}`);
  }
}

async function chooseGroupSelection(groups) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return { kind: 'skip', ids: [] };
  }

  if (groups.length === 1) {
    const picked = await promptSelect({
      message: 'Apply now?',
      defaultValue: 'skip',
      choices: [
        { label: 'No, skip for now', value: 'skip' },
        { label: `Yes, apply "${groups[0].title}"`, value: groups[0].id },
      ],
    });
    if (picked === 'skip') {
      return { kind: 'skip', ids: [] };
    }
    return { kind: 'single', ids: [picked] };
  }

  const choices = groups.map((group) => ({
    label: group.title,
    value: group.id,
  }));
  choices.push({ label: 'Skip for now', value: '__skip' });
  choices.push({ label: 'Sync all pending integrations', value: '__all' });

  const picked = await promptSelect({
    message: 'Select integration to apply now',
    defaultValue: '__skip',
    choices,
  });

  if (picked === '__skip') {
    return { kind: 'skip', ids: [] };
  }
  if (picked === '__all') {
    return { kind: 'all', ids: groups.map((group) => group.id) };
  }
  return { kind: 'single', ids: [picked] };
}

export async function runIntegrationFlow({
  targetRoot,
  packageRoot,
  relatedModuleId = null,
  scanMessage = 'Scanning for integrations...',
}) {
  console.log(scanMessage);
  const scan = scanIntegrations({ targetRoot, relatedModuleId });
  if (scan.groups.length === 0) {
    console.log('No integration groups found.');
    return { scanned: true, applied: false, groups: [] };
  }

  const groupWord = scan.groups.length === 1 ? 'group' : 'groups';
  console.log(colorize('yellow', `Found ${scan.groups.length} integration ${groupWord}:`));
  for (const group of scan.groups) {
    printGroup(group);
  }

  console.log(colorize('dim', 'Command: pnpm forgeon:sync-integrations'));
  const selection = await chooseGroupSelection(scan.groups);
  if (selection.kind === 'skip') {
    console.log('Integration skipped.');
    console.log('Run later with: pnpm forgeon:sync-integrations');
    return { scanned: true, applied: false, groups: scan.groups };
  }

  const sync = syncIntegrations({ targetRoot, packageRoot, groupIds: selection.ids });
  console.log('[forgeon:sync-integrations] done');
  for (const item of sync.summary) {
    if (item.result.applied) {
      console.log(`- ${item.title}: applied`);
    } else {
      console.log(`- ${item.title}: skipped (${item.result.reason})`);
    }
  }
  if (sync.changedFiles.length > 0) {
    console.log('- changed files:');
    for (const filePath of sync.changedFiles) {
      console.log(`  - ${filePath}`);
    }
  }
  return { scanned: true, applied: true, groups: scan.groups, sync };
}

export function printModuleAdded(moduleId, docsPath) {
  console.log(colorize('green', `✔ Module added: ${moduleId}`));
  console.log(`- docs: ${docsPath}`);
}
