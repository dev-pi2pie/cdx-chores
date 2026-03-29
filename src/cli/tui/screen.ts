export function dim(text: string): string {
  return text.length > 0 ? `\x1b[2m${text}\x1b[22m` : "";
}

export function beep(stdout: NodeJS.WritableStream): void {
  stdout.write("\x07");
}

export function clearCurrentLine(stdout: NodeJS.WritableStream): void {
  stdout.write("\r\x1b[2K");
}

export function moveCursorLeft(stdout: NodeJS.WritableStream, count: number): void {
  if (count <= 0) {
    return;
  }
  stdout.write(`\x1b[${count}D`);
}

export function saveCursor(stdout: NodeJS.WritableStream): void {
  stdout.write("\x1b7");
}

export function restoreCursor(stdout: NodeJS.WritableStream): void {
  stdout.write("\x1b8");
}

export function moveCursorUp(stdout: NodeJS.WritableStream, count: number): void {
  if (count <= 0) {
    return;
  }
  stdout.write(`\x1b[${count}A`);
}

export function moveCursorDown(stdout: NodeJS.WritableStream, count: number): void {
  if (count <= 0) {
    return;
  }
  stdout.write(`\x1b[${count}B`);
}

export function hideCursor(stdout: NodeJS.WritableStream): void {
  stdout.write("\x1b[?25l");
}

export function showCursor(stdout: NodeJS.WritableStream): void {
  stdout.write("\x1b[?25h");
}
