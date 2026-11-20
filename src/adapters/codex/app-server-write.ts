import type { Writable } from "node:stream";

// A false return can mean either buffered bytes or an immediate stream failure.
export function writeAppServerTurn(
  stdin: Writable,
  line: string,
  stop: (error: Error) => void,
): void {
  function checkInput(requireWritable: boolean): void {
    const error =
      stdin.errored ??
      (requireWritable && !stdin.writable
        ? new Error("Codex app-server stdin is not writable.")
        : null);
    if (error) {
      stop(error);
      throw error;
    }
  }

  checkInput(true);
  try {
    stdin.write(line);
  } catch (error) {
    checkInput(true);
    throw error;
  }
  checkInput(false);
}
