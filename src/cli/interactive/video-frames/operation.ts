import { CliError } from "../../errors";
import { FrameExportError } from "../../video-frames/export";
import { createKeypressParser, startRawSession, supportsRawSessionIO } from "../../tui";
import type { FramePromptIO } from "./simple-prompts";

export function fatalFrameFailure(error: unknown): boolean {
  return (
    (error instanceof CliError && error.code === "PROCESS_STOP_FAILED") ||
    (error instanceof FrameExportError && error.result.stopFlow)
  );
}
/** Own input only while work is active; return to prompts after confirmed settlement. */
export async function runFrameWork<T>(
  io: FramePromptIO,
  label: string,
  body: (signal: AbortSignal) => Promise<T>,
  onProgress?: (update: (frames: number) => void) => void,
): Promise<T | undefined> {
  const controller = new AbortController();
  const signal = io.signal ? AbortSignal.any([io.signal, controller.signal]) : controller.signal;
  signal.throwIfAborted();
  let escaped = false,
    interrupted = false;
  io.output.write(`${label}… Esc Cancel · Ctrl+C Exit\n`);
  const parser = createKeypressParser({
    onEscapeAbort: () => {
      escaped = true;
      controller.abort();
      io.output.write("Stopping…\n");
    },
  });
  const session = supportsRawSessionIO(io.input, io.output)
    ? startRawSession({ stdin: io.input, stdout: io.output, onTeardown: () => parser.dispose() })
    : undefined;
  session?.addKeypressListener((str, key) => {
    if (key.ctrl && (key.name === "c" || key.name === "d")) {
      interrupted = true;
      controller.abort();
      io.output.write("Stopping…\n");
    } else parser.handle(str, key);
  });
  onProgress?.((frames) => io.output.write(`${label}: ${frames} source frames inspected.\n`));
  try {
    return await body(signal);
  } catch (error) {
    if (fatalFrameFailure(error)) throw error;
    if (interrupted || io.signal?.aborted)
      throw new CliError("Operation cancelled.", { code: "PROCESS_CANCELLED", exitCode: 130 });
    if (escaped) {
      io.output.write("Cancelled.\n");
      return;
    }
    throw error;
  } finally {
    session?.close();
    parser.dispose();
  }
}
