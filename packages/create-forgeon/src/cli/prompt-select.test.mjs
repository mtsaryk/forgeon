import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
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

  it('restores paused stdin state after interactive selection', async () => {
    class MockInput extends EventEmitter {
      constructor() {
        super();
        this.isTTY = true;
        this.isRaw = false;
        this._paused = true;
      }

      setRawMode(value) {
        this.isRaw = value;
      }

      pause() {
        this._paused = true;
      }

      resume() {
        this._paused = false;
      }

      isPaused() {
        return this._paused;
      }
    }

    class MockOutput {
      constructor() {
        this.isTTY = true;
      }

      write() {}
    }

    const inputStream = new MockInput();
    const outputStream = new MockOutput();

    const selectionPromise = promptSelect({
      message: 'Pick one',
      defaultValue: 'a',
      choices: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
      inputStream,
      outputStream,
    });

    inputStream.emit('keypress', '', { name: 'down' });
    inputStream.emit('keypress', '', { name: 'return' });

    const value = await selectionPromise;

    assert.equal(value, 'b');
    assert.equal(inputStream.isPaused(), true);
    assert.equal(inputStream.isRaw, false);
  });
});
