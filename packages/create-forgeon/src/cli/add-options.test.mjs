import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAddCliArgs } from './add-options.mjs';

describe('parseAddCliArgs', () => {
  it('parses module id and explicit project', () => {
    const options = parseAddCliArgs(['jwt-auth', '--project', './demo']);
    assert.equal(options.moduleId, 'jwt-auth');
    assert.equal(options.project, './demo');
    assert.equal(options.list, false);
  });

  it('parses --list and --help', () => {
    const options = parseAddCliArgs(['--list', '--help']);
    assert.equal(options.list, true);
    assert.equal(options.help, true);
  });

  it('uses second positional as project when project flag is absent', () => {
    const options = parseAddCliArgs(['queue', './my-app']);
    assert.equal(options.moduleId, 'queue');
    assert.equal(options.project, './my-app');
  });
});
