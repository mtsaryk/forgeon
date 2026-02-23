#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const args = process.argv.slice(2);
const options = {
  name: undefined,
  frontend: undefined,
  db: undefined,
  i18n: undefined,
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  const [key, rawValue] = arg.split('=');
  const value = rawValue ?? args[i + 1];

  if (key === '--name') {
    options.name = value;
    if (rawValue === undefined) i += 1;
  }
  if (key === '--frontend') {
    options.frontend = value;
    if (rawValue === undefined) i += 1;
  }
  if (key === '--db') {
    options.db = value;
    if (rawValue === undefined) i += 1;
  }
  if (key === '--i18n') {
    options.i18n = value;
    if (rawValue === undefined) i += 1;
  }
}

const rl = readline.createInterface({ input, output });

const projectName = options.name ?? (await rl.question('Project name: '));
const frontend =
  options.frontend ??
  (await rl.question('Frontend (react/angular) [react]: ')) ||
  'react';
const db = options.db ?? (await rl.question('DB preset [prisma]: ')) || 'prisma';
const i18n =
  options.i18n ?? (await rl.question('Enable i18n (true/false) [true]: ')) || 'true';

await rl.close();

if (!projectName) {
  console.error('Project name is required.');
  process.exit(1);
}

if (frontend !== 'react') {
  console.warn('Only react preset is currently implemented. Falling back to react.');
}

if (db !== 'prisma') {
  console.warn('Only prisma preset is currently implemented. Falling back to prisma.');
}

const sourceRoot = path.resolve(process.cwd());
const targetRoot = path.resolve(process.cwd(), projectName);

if (fs.existsSync(targetRoot)) {
  console.error(`Target directory already exists: ${targetRoot}`);
  process.exit(1);
}

const skipNames = new Set([
  'node_modules',
  '.git',
  '.idea',
  '.vscode',
  projectName,
]);

function copyRecursive(from, to) {
  const stat = fs.statSync(from);

  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    const entries = fs.readdirSync(from);
    for (const entry of entries) {
      if (skipNames.has(entry)) continue;
      copyRecursive(path.join(from, entry), path.join(to, entry));
    }
    return;
  }

  fs.copyFileSync(from, to);
}

copyRecursive(sourceRoot, targetRoot);

const envPath = path.join(targetRoot, 'infra', 'docker', '.env.example');
if (fs.existsSync(envPath)) {
  const current = fs.readFileSync(envPath, 'utf8');
  const next = current.replace(/I18N_ENABLED=.*/g, `I18N_ENABLED=${i18n}`);
  fs.writeFileSync(envPath, next, 'utf8');
}

console.log('Scaffold generated.');
console.log(`- path: ${targetRoot}`);
console.log(`- frontend: react`);
console.log(`- db: prisma`);
console.log(`- i18n: ${i18n}`);
