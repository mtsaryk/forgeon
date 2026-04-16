import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive, writeJson } from '../utils/fs.mjs';
import {
  ensureBuildSteps,
  ensureDependency,
  ensureLineAfter,
  ensureLineBefore,
  upsertEnvLines,
} from './shared/patch-utils.mjs';
import { patchAppModuleRegistration } from './shared/nest-runtime-wiring.mjs';
import { ensureWebProbeDefinition, resolveProbeTargets } from './shared/probes.mjs';

function copyFromPreset(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'module-presets', 'communications', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing communications preset template: ${source}`);
  }
  const destination = path.join(targetRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  copyRecursive(source, destination);
}

function patchApiPackage(targetRoot) {
  const packagePath = path.join(targetRoot, 'apps', 'api', 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  ensureDependency(packageJson, '@forgeon/communications', 'workspace:*');
  ensureBuildSteps(packageJson, 'predev', ['pnpm --filter @forgeon/communications build']);
  writeJson(packagePath, packageJson);
}

function patchAppModule(targetRoot) {
  patchAppModuleRegistration(targetRoot, {
    importLine: "import { communicationsConfig, communicationsEnvSchema, ForgeonCommunicationsModule } from '@forgeon/communications';",
    loadItem: 'communicationsConfig',
    envSchema: 'communicationsEnvSchema',
    moduleLine: '    ForgeonCommunicationsModule.register(),',
    afterAnchors: ['    DbPrismaModule,', '    ForgeonLoggerModule,'],
    fallbackAnchor: '    CoreErrorsModule,',
  });
}

function registerWebProbe(targetRoot) {
  const probeTargets = resolveProbeTargets({ targetRoot, moduleId: 'communications' });
  ensureWebProbeDefinition({
    targetRoot,
    probeTargets,
    definition: {
      id: 'communications',
      title: 'Communications',
      buttonLabel: 'Send communications probe email',
      resultTitle: 'Communications probe response',
      path: '/health/communications',
      request: {
        method: 'POST',
        body: {
          email: '$INPUT.email$',
        },
      },
      inputs: [
        {
          id: 'email',
          label: 'Test email',
          type: 'email',
          placeholder: 'you@example.com',
          defaultValue: 'probe@example.com',
        },
      ],
    },
  });
}

function patchApiDockerfile(targetRoot) {
  const dockerfilePath = path.join(targetRoot, 'apps', 'api', 'Dockerfile');
  if (!fs.existsSync(dockerfilePath)) {
    return;
  }

  let content = fs.readFileSync(dockerfilePath, 'utf8').replace(/\r\n/g, '\n');
  const packageAnchors = [
    'COPY packages/accounts-api/package.json packages/accounts-api/package.json',
    'COPY packages/logger/package.json packages/logger/package.json',
    'COPY packages/i18n/package.json packages/i18n/package.json',
    'COPY packages/db-prisma/package.json packages/db-prisma/package.json',
    'COPY packages/core/package.json packages/core/package.json',
  ];
  const packageAnchor = packageAnchors.find((line) => content.includes(line)) ?? packageAnchors.at(-1);
  content = ensureLineAfter(content, packageAnchor, 'COPY packages/communications/package.json packages/communications/package.json');

  const sourceAnchors = [
    'COPY packages/accounts-api packages/accounts-api',
    'COPY packages/logger packages/logger',
    'COPY packages/i18n packages/i18n',
    'COPY packages/db-prisma packages/db-prisma',
    'COPY packages/core packages/core',
  ];
  const sourceAnchor = sourceAnchors.find((line) => content.includes(line)) ?? sourceAnchors.at(-1);
  content = ensureLineAfter(content, sourceAnchor, 'COPY packages/communications packages/communications');

  content = content.replace(/^RUN pnpm --filter @forgeon\/communications build\r?\n?/gm, '');
  const buildAnchor = content.includes('RUN pnpm --filter @forgeon/api prisma:generate')
    ? 'RUN pnpm --filter @forgeon/api prisma:generate'
    : 'RUN pnpm --filter @forgeon/api build';
  content = ensureLineBefore(content, buildAnchor, 'RUN pnpm --filter @forgeon/communications build');

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchCompose(targetRoot) {
  const composePath = path.join(targetRoot, 'infra', 'docker', 'compose.yml');
  if (!fs.existsSync(composePath)) {
    return;
  }

  let content = fs.readFileSync(composePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes('COMMUNICATIONS_EMAIL_PROVIDER: ${COMMUNICATIONS_EMAIL_PROVIDER}')) {
    content = content.replace(
      /^(\s+API_PREFIX:.*)$/m,
      `$1
      COMMUNICATIONS_TEMPLATES_ROOT: \${COMMUNICATIONS_TEMPLATES_ROOT}
      COMMUNICATIONS_EMAIL_PROVIDER: \${COMMUNICATIONS_EMAIL_PROVIDER}
      COMMUNICATIONS_EMAIL_FROM: \${COMMUNICATIONS_EMAIL_FROM}
      COMMUNICATIONS_EMAIL_REPLY_TO: \${COMMUNICATIONS_EMAIL_REPLY_TO}
      COMMUNICATIONS_EMAIL_SUBJECT_PREFIX: \${COMMUNICATIONS_EMAIL_SUBJECT_PREFIX}
      COMMUNICATIONS_EMAIL_SMTP_HOST: \${COMMUNICATIONS_EMAIL_SMTP_HOST}
      COMMUNICATIONS_EMAIL_SMTP_PORT: \${COMMUNICATIONS_EMAIL_SMTP_PORT}
      COMMUNICATIONS_EMAIL_SMTP_SECURE: \${COMMUNICATIONS_EMAIL_SMTP_SECURE}
      COMMUNICATIONS_EMAIL_SMTP_USER: \${COMMUNICATIONS_EMAIL_SMTP_USER}
      COMMUNICATIONS_EMAIL_SMTP_PASS: \${COMMUNICATIONS_EMAIL_SMTP_PASS}
      COMMUNICATIONS_SMS_PROVIDER: \${COMMUNICATIONS_SMS_PROVIDER}
      COMMUNICATIONS_PUSH_PROVIDER: \${COMMUNICATIONS_PUSH_PROVIDER}`,
    );
  }

  fs.writeFileSync(composePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const section = [
    '## Communications Module',
    '',
    'The communications add-module provides a single orchestration surface for email, sms, and push delivery.',
    '',
    'What it adds:',
    '- `@forgeon/communications` backend runtime with file-based template loading and simple placeholder rendering',
    '- real email delivery through the Gmail SMTP transport configuration',
    '- SMS and PUSH stub channels for future expansion',
    '- probe routes: `GET /api/health/communications` and `POST /api/health/communications`',
    '- generated resources under `resources/communications/email`, `resources/communications/sms`, and `resources/communications/push`',
    '',
    'Current boundaries:',
    '- domain modules should inject only `CommunicationsService`',
    '- provider selection is module-owned configuration, never a runtime input field',
    '- queues, scheduling, delivery history, and retries are intentionally out of scope for v1',
    '',
    'Example env keys:',
    '- `COMMUNICATIONS_EMAIL_PROVIDER=gmail-smtp`',
    '- `COMMUNICATIONS_EMAIL_SMTP_HOST=smtp.gmail.com`',
    '- `COMMUNICATIONS_EMAIL_FROM=` (falls back to the SMTP user when left empty)',
    '- `COMMUNICATIONS_EMAIL_SMTP_USER=`',
    '- `COMMUNICATIONS_EMAIL_SMTP_PASS=`',
  ].join('\n');

  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  const sectionHeading = '## Communications Module';
  if (content.includes(sectionHeading)) {
    const start = content.indexOf(sectionHeading);
    const tail = content.slice(start + sectionHeading.length);
    const nextHeadingMatch = tail.match(/\n##\s+/);
    const end =
      nextHeadingMatch && nextHeadingMatch.index !== undefined
        ? start + sectionHeading.length + nextHeadingMatch.index + 1
        : content.length;
    content = `${content.slice(0, start)}${section}\n\n${content.slice(end).replace(/^\n+/, '')}`;
  } else if (content.includes('## Prisma In Docker Start')) {
    content = content.replace('## Prisma In Docker Start', `${section}\n\n## Prisma In Docker Start`);
  } else {
    content = `${content.trimEnd()}\n\n${section}\n`;
  }

  fs.writeFileSync(readmePath, `${content.trimEnd()}\n`, 'utf8');
}

export function applyCommunicationsModule({ packageRoot, targetRoot }) {
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'communications'));
  copyFromPreset(packageRoot, targetRoot, path.join('resources', 'communications'));

  patchApiPackage(targetRoot);
  patchAppModule(targetRoot);
  registerWebProbe(targetRoot);
  patchApiDockerfile(targetRoot);
  patchCompose(targetRoot);
  patchReadme(targetRoot);

  upsertEnvLines(path.join(targetRoot, 'apps', 'api', '.env.example'), [
    'COMMUNICATIONS_TEMPLATES_ROOT=resources/communications',
    'COMMUNICATIONS_EMAIL_PROVIDER=gmail-smtp',
    'COMMUNICATIONS_EMAIL_FROM=',
    'COMMUNICATIONS_EMAIL_REPLY_TO=',
    'COMMUNICATIONS_EMAIL_SUBJECT_PREFIX=[Forgeon]',
    'COMMUNICATIONS_EMAIL_SMTP_HOST=smtp.gmail.com',
    'COMMUNICATIONS_EMAIL_SMTP_PORT=587',
    'COMMUNICATIONS_EMAIL_SMTP_SECURE=false',
    'COMMUNICATIONS_EMAIL_SMTP_USER=',
    'COMMUNICATIONS_EMAIL_SMTP_PASS=',
    'COMMUNICATIONS_SMS_PROVIDER=stub',
    'COMMUNICATIONS_PUSH_PROVIDER=stub',
  ]);

  upsertEnvLines(path.join(targetRoot, 'infra', 'docker', '.env.example'), [
    'COMMUNICATIONS_TEMPLATES_ROOT=resources/communications',
    'COMMUNICATIONS_EMAIL_PROVIDER=gmail-smtp',
    'COMMUNICATIONS_EMAIL_FROM=',
    'COMMUNICATIONS_EMAIL_REPLY_TO=',
    'COMMUNICATIONS_EMAIL_SUBJECT_PREFIX=[Forgeon]',
    'COMMUNICATIONS_EMAIL_SMTP_HOST=smtp.gmail.com',
    'COMMUNICATIONS_EMAIL_SMTP_PORT=587',
    'COMMUNICATIONS_EMAIL_SMTP_SECURE=false',
    'COMMUNICATIONS_EMAIL_SMTP_USER=',
    'COMMUNICATIONS_EMAIL_SMTP_PASS=',
    'COMMUNICATIONS_SMS_PROVIDER=stub',
    'COMMUNICATIONS_PUSH_PROVIDER=stub',
  ]);
}
