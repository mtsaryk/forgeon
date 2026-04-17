import fs from 'node:fs';
import path from 'node:path';
import { copyRecursive, writeJson } from '../utils/fs.mjs';
import {
  ensureBuildSteps,
  ensureDependency,
  ensureImportLine,
  ensureLineAfter,
  ensureLineBefore,
} from './shared/patch-utils.mjs';

function copyFromPreset(packageRoot, targetRoot, relativePath) {
  const source = path.join(packageRoot, 'templates', 'module-presets', 'accounts-communications', relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing accounts-communications preset template: ${source}`);
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
  ensureDependency(packageJson, '@forgeon/accounts-communications', 'workspace:*');
  ensureBuildSteps(packageJson, 'predev', ['pnpm --filter @forgeon/accounts-communications build']);
  writeJson(packagePath, packageJson);
}

function patchAppModule(targetRoot) {
  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  content = ensureImportLine(
    content,
    "import { AuthCommunicationsController, AuthCommunicationsService, ConfirmedChangePasswordHandler, PendingVerificationRegisterHandler } from '@forgeon/accounts-communications';",
  );

  const accountsModuleLine = `    ForgeonAccountsModule.register({
      users: UsersModule.register({}),
      controllers: [AuthCommunicationsController],
      providers: [
        AuthCommunicationsService,
        PendingVerificationRegisterHandler,
        ConfirmedChangePasswordHandler,
      ],
      handlers: {
        register: PendingVerificationRegisterHandler,
        changePassword: ConfirmedChangePasswordHandler,
      },
    }),`;

  if (content.includes('    ForgeonAccountsModule.register({')) {
    content = content.replace(
      / {4}ForgeonAccountsModule\.register\([\s\S]*? {4}\}\),/m,
      accountsModuleLine,
    );
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchApiDockerfile(targetRoot) {
  const dockerfilePath = path.join(targetRoot, 'apps', 'api', 'Dockerfile');
  if (!fs.existsSync(dockerfilePath)) {
    return;
  }

  let content = fs.readFileSync(dockerfilePath, 'utf8').replace(/\r\n/g, '\n');
  content = ensureLineAfter(
    content,
    'COPY packages/accounts-api/package.json packages/accounts-api/package.json',
    'COPY packages/accounts-communications/package.json packages/accounts-communications/package.json',
  );
  content = ensureLineAfter(
    content,
    'COPY packages/accounts-api packages/accounts-api',
    'COPY packages/accounts-communications packages/accounts-communications',
  );

  content = content.replace(/^RUN pnpm --filter @forgeon\/accounts-communications build\r?\n?/gm, '');
  const buildAnchor = content.includes('RUN pnpm --filter @forgeon/api prisma:generate')
    ? 'RUN pnpm --filter @forgeon/api prisma:generate'
    : 'RUN pnpm --filter @forgeon/api build';
  content = ensureLineBefore(content, buildAnchor, 'RUN pnpm --filter @forgeon/accounts-communications build');

  fs.writeFileSync(dockerfilePath, `${content.trimEnd()}\n`, 'utf8');
}

function patchReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return;
  }

  const section = [
    '## Accounts Communications Module',
    '',
    'The accounts-communications add-module extends the base accounts runtime with communications-backed auth/account flows.',
    '',
    'What it adds:',
    '- `@forgeon/accounts-communications` extension runtime for messaging-based auth/account operations',
    '- pending-verification registration mode',
    '- confirmable password changes and password reset flows',
    '- email change confirmation routes under the same `/api/auth/*` namespace',
    '',
    'Current boundaries:',
    '- requires both `accounts` and `communications`',
    '- rebinds `register` and `change-password` handler implementations through the accounts composition point',
    '- keeps base account state and pending-operation records inside `accounts`',
  ].join('\n');

  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  const sectionHeading = '## Accounts Communications Module';
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

export function applyAccountsCommunicationsModule({ packageRoot, targetRoot }) {
  copyFromPreset(packageRoot, targetRoot, path.join('packages', 'accounts-communications'));
  patchApiPackage(targetRoot);
  patchAppModule(targetRoot);
  patchApiDockerfile(targetRoot);
  patchReadme(targetRoot);
}
