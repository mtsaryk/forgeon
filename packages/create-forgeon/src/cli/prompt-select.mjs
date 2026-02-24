import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';

export async function promptSelect({
  message,
  choices,
  defaultValue,
  inputStream = input,
  outputStream = output,
}) {
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('promptSelect requires at least one choice.');
  }

  let index = choices.findIndex((choice) => choice.value === defaultValue);
  if (index < 0) index = 0;

  if (!inputStream.isTTY || !outputStream.isTTY) {
    return choices[index].value;
  }

  readline.emitKeypressEvents(inputStream);

  const canSetRawMode = typeof inputStream.setRawMode === 'function';
  const wasRawModeEnabled = Boolean(inputStream.isRaw);
  const canResume = typeof inputStream.resume === 'function';
  const canPause = typeof inputStream.pause === 'function';
  const wasPaused = typeof inputStream.isPaused === 'function' ? inputStream.isPaused() : false;

  if (canResume && wasPaused) {
    inputStream.resume();
  }

  if (canSetRawMode && !wasRawModeEnabled) {
    inputStream.setRawMode(true);
  }

  let renderedLines = 0;

  const render = () => {
    if (renderedLines > 0) {
      readline.moveCursor(outputStream, 0, -renderedLines);
      readline.cursorTo(outputStream, 0);
      readline.clearScreenDown(outputStream);
    }

    outputStream.write(`${message}\n`);
    for (let i = 0; i < choices.length; i += 1) {
      const marker = i === index ? '>' : ' ';
      outputStream.write(`${marker} ${choices[i].label}\n`);
    }
    outputStream.write('Use Up/Down arrows and Enter.\n');

    renderedLines = choices.length + 2;
  };

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      inputStream.off('keypress', onKeypress);
      if (canSetRawMode && !wasRawModeEnabled) {
        inputStream.setRawMode(false);
      }
      if (canPause && wasPaused) {
        inputStream.pause();
      }
      outputStream.write('\n');
    };

    const onKeypress = (_str, key) => {
      if (!key) return;

      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Prompt cancelled.'));
        return;
      }

      if (key.name === 'up') {
        index = (index - 1 + choices.length) % choices.length;
        render();
        return;
      }

      if (key.name === 'down') {
        index = (index + 1) % choices.length;
        render();
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        const selected = choices[index].value;
        cleanup();
        resolve(selected);
      }
    };

    render();
    inputStream.on('keypress', onKeypress);
  });
}
