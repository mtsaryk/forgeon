import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs } from './options.mjs';

describe('parseCliArgs', () => {
  it('parses positional name and supported inline options', () => {
    const { options, positional } = parseCliArgs([
      'demo-app',
      '--db-prisma=false',
      '--i18n=false',
      '--proxy=caddy',
      '--install',
      '--yes',
    ]);

    assert.equal(positional[0], 'demo-app');
    assert.equal(options.dbPrisma, 'false');
    assert.equal(options.i18n, 'false');
    assert.equal(options.proxy, 'caddy');
    assert.equal(options.install, true);
    assert.equal(options.yes, true);
  });

  it('parses separated option values and negated i18n flag', () => {
    const { options } = parseCliArgs(['--proxy', 'none', '--no-i18n', '--no-db-prisma', '--help']);

    assert.equal(options.proxy, 'none');
    assert.equal(options.i18n, false);
    assert.equal(options.dbPrisma, false);
    assert.equal(options.help, true);
  });

  it('throws for removed stack-selection flags', () => {
    assert.throws(
      () => parseCliArgs(['demo', '--frontend=react']),
      /Option "--frontend" has been removed/,
    );
    assert.throws(() => parseCliArgs(['demo', '--db=prisma']), /Option "--db" has been removed/);
    assert.throws(
      () => parseCliArgs(['demo', '--docker=true']),
      /Option "--docker" has been removed/,
    );
  });
});
