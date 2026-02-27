#!/usr/bin/env node
import { runCreateForgeon } from '../src/run-create-forgeon.mjs';
import { runAddModule } from '../src/run-add-module.mjs';
import { runScanIntegrations } from '../src/run-scan-integrations.mjs';

const args = process.argv.slice(2);
const command = args[0];

const task =
  command === 'add'
    ? runAddModule(args.slice(1))
    : command === 'scan-integrations'
      ? runScanIntegrations(args.slice(1))
    : runCreateForgeon(args);

task.then(() => {
  if (typeof process.stdin.pause === 'function') {
    process.stdin.pause();
  }
});

task.catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
