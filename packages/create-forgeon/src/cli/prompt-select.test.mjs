import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promptSelect } from './prompt-select.mjs';

describe('promptSelect', () => {
  it('returns default choice in non-tty mode', async () => {
    const value = await promptSelect({
      message: 'Pick one',
      defaultValue: 'b',
      choices: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
      inputStream: { isTTY: false },
      outputStream: { isTTY: false },
    });

    assert.equal(value, 'b');
  });

  it('throws for empty choices', async () => {
    await assert.rejects(
      () =>
        promptSelect({
          message: 'Pick one',
          defaultValue: 'a',
          choices: [],
          inputStream: { isTTY: false },
          outputStream: { isTTY: false },
        }),
      /requires at least one choice/,
    );
  });
});
