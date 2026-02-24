#!/usr/bin/env node
import { runCreateForgeon } from '../src/run-create-forgeon.mjs';
import { runAddModule } from '../src/run-add-module.mjs';

const args = process.argv.slice(2);
const command = args[0];

const task =
  command === 'add'
    ? runAddModule(args.slice(1))
    : runCreateForgeon(args);

task.catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
