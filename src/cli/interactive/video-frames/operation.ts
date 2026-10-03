import { CliError } from "../../errors";
import {
  createFrameProgressPresenter,
  type FrameProgressPresenter,
} from "../../actions/video-frames-progress";
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
  io: FramePromptIO & { colorEnabled?: boolean; progressOutput?: NodeJS.WritableStream },
  label: string,
  body: (signal: AbortSignal, presenter: FrameProgressPresenter) => Promise<T>,
  onProgress?: (update: (frames: number) => void) => void,
): Promise<T | undefined> {
  const controller = new AbortController();
  const signal = io.signal ? AbortSignal.any([io.signal, controller.signal]) : controller.signal;
  signal.throwIfAborted();
  let escaped = false,
    interrupted = false;
  const presenter = createFrameProgressPresenter(io.progressOutput ?? io.output, {
    label,
    colorEnabled: io.colorEnabled,
    controls: true,
  });
  const stopping = () => presenter.stopping();
  signal.addEventListener("abort", stopping, { once: true });
  const parser = createKeypressParser({
    onEscapeAbort: () => {
      if (escaped || interrupted) return;
      escaped = true;
      controller.abort();
    },
  });
  let session: ReturnType<typeof startRawSession> | undefined;
  try {
    session = supportsRawSessionIO(io.input, io.output)
      ? startRawSession({ stdin: io.input, stdout: io.output, onTeardown: () => parser.dispose() })
      : undefined;
    session?.addKeypressListener((str, key) => {
      if (key.ctrl && (key.name === "c" || key.name === "d")) {
        interrupted = true;
        controller.abort();
      } else parser.handle(str, key);
    });
    onProgress?.((frames) => presenter.update({ phase: "scanning", inspected: frames }));
    const result = await body(signal, presenter);
    if (interrupted || io.signal?.aborted)
      throw new CliError("Operation cancelled.", { code: "PROCESS_CANCELLED", exitCode: 130 });
    if (escaped) {
      presenter.stop();
      io.output.write("Cancelled\n");
      return;
    }
    return result;
  } catch (error) {
    if (fatalFrameFailure(error)) throw error;
    if (interrupted || io.signal?.aborted)
      throw new CliError("Operation cancelled.", { code: "PROCESS_CANCELLED", exitCode: 130 });
    if (escaped) {
      presenter.stop();
      io.output.write("Cancelled\n");
      return;
    }
    throw error;
  } finally {
    signal.removeEventListener("abort", stopping);
    presenter.stop();
    session?.close();
    parser.dispose();
  }
}
