import {
  supportsRawSessionIO,
  startRawSession,
  createKeypressParser,
  type RawSession,
} from "../../tui";
import {
  derivePickerLayout,
  directPickerTitle,
  selectionDetails,
  wrapPickerLine,
  type PickerLayout,
} from "./layout";
import { createPickerRenderer } from "./renderer";
import { chooseFrameOption, enterFrameValue, type FramePromptIO } from "./simple-prompts";
import {
  moveFrameCandidate,
  parseFrameNumber,
  parseFrameTime,
  type FrameIdentity,
  type FramePickerState,
  type FrameRequest,
} from "./selection";
import { fatalFrameFailure, runFrameWork } from "./operation";

export interface PickerObservation {
  layout: PickerLayout["kind"];
  state: FramePickerState;
  editor?: { kind: "frame" | "time"; draft: string; cursor: number };
  resolving: boolean;
}

export interface FramePickerOptions extends FramePromptIO {
  durationMs?: number;
  sourceLabel?: string;
  initialState?: FramePickerState;
  simple?: boolean;
  colorEnabled?: boolean;
  resolve: (
    request: FrameRequest,
    signal: AbortSignal,
    progress?: (frames: number) => void,
  ) => Promise<FrameIdentity>;
  onChange?: (observation: PickerObservation) => void;
}

export interface FramePickerResult extends FramePickerState {
  resolved: FrameIdentity;
  // Wave and frame/time input are custom selection, even when they resolve an endpoint.
  selection: "custom";
}

function abortError(): Error {
  const error = new Error("User aborted prompt");
  error.name = "ExitPromptError";
  return error;
}

function layoutFor(options: FramePickerOptions, state: FramePickerState): PickerLayout {
  const output = options.output as NodeJS.WriteStream;
  return derivePickerLayout({
    columns: output.columns,
    rows: output.rows,
    durationMs: options.durationMs,
    sourceLabel: options.sourceLabel,
    simple: options.simple,
    state,
  });
}

type WaveOutcome =
  | { kind: "direct"; state: FramePickerState }
  | { kind: "result"; result: FramePickerResult | null };

async function runWave(
  options: FramePickerOptions,
  initial: FramePickerState,
): Promise<WaveOutcome> {
  let state = initial;
  let editor: PickerObservation["editor"];
  let notice = "";
  let busy: AbortController | undefined;
  let stopping = false;
  let interrupted = false;
  let closed = false;
  let scanned = 0;
  let session: RawSession | undefined;
  const renderer = createPickerRenderer(options.output);
  return await new Promise<WaveOutcome>((resolve, reject) => {
    const cleanup = () => {
      closed = true;
      options.output.off("resize", resize);
      options.signal?.removeEventListener("abort", interrupt);
      session?.close();
      renderer.close();
    };
    const finish = (outcome: WaveOutcome) => {
      if (!closed) {
        cleanup();
        resolve(outcome);
      }
    };
    const fail = (error: unknown) => {
      if (!closed) {
        cleanup();
        reject(error);
      }
    };
    const render = () => {
      if (closed) return;
      const layout = layoutFor(options, state);
      if (layout.kind === "direct" && !editor && !busy) {
        finish({ kind: "direct", state });
        return;
      }
      const columns = (options.output as NodeJS.WriteStream).columns;
      const width = Math.max(1, Number.isSafeInteger(columns) ? columns - 1 : 79);
      const lines = editor
        ? [
            ...selectionDetails(state),
            `${editor.kind === "frame" ? "Source frame (1-based)" : "Time HH:MM:SS[.mmm]"}: ${editor.draft.slice(0, editor.cursor)}▏${editor.draft.slice(editor.cursor)}`,
            "Enter Submit   Esc Cancel",
            ...(notice ? [notice] : []),
          ].flatMap((line) => wrapPickerLine(line, width))
        : busy
          ? [
              ...selectionDetails(state),
              stopping ? "Stopping…" : `Resolving… ${scanned} source frames inspected · Esc Cancel`,
            ].flatMap((line) => wrapPickerLine(line, width))
          : layout.lines;
      renderer.render(
        lines,
        editor || busy ? undefined : { layout, colorEnabled: options.colorEnabled ?? true },
      );
      options.onChange?.({
        layout: layout.kind,
        state,
        editor: editor ? { ...editor } : undefined,
        resolving: Boolean(busy),
      });
    };
    const resize = () => {
      try {
        render();
      } catch (error) {
        fail(error);
      }
    };
    const interrupt = () => {
      interrupted = true;
      if (busy) {
        stopping = true;
        busy.abort();
        render();
      } else fail(abortError());
    };
    const escape = () => {
      if (busy) {
        stopping = true;
        busy.abort();
        render();
      } else if (editor) {
        editor = undefined;
        notice = "";
        render();
      } else finish({ kind: "result", result: null });
    };
    const resolveRequest = async (request: FrameRequest) => {
      state = { request, glyphs: state.glyphs };
      editor = undefined;
      const operation = new AbortController();
      busy = operation;
      scanned = 0;
      render();
      try {
        const identity = await options.resolve(request, operation.signal, (frames) => {
          scanned = frames;
          render();
        });
        if (interrupted) throw abortError();
        if (operation.signal.aborted) {
          busy = undefined;
          stopping = false;
          render();
          return;
        }
        finish({ kind: "result", result: { ...state, resolved: identity, selection: "custom" } });
      } catch (error) {
        if (fatalFrameFailure(error)) fail(error);
        else if (interrupted) fail(abortError());
        else if (operation.signal.aborted) {
          busy = undefined;
          stopping = false;
          render();
        } else fail(error);
      }
    };
    const parser = createKeypressParser({ onEscapeAbort: escape });
    try {
      session = startRawSession({
        stdin: options.input,
        stdout: options.output,
        onTeardown: () => parser.dispose(),
      });
      session.addKeypressListener((str, key) => {
        try {
          if (key.ctrl && (key.name === "c" || key.name === "d")) {
            interrupt();
            return;
          }
          const parsed = parser.handle(str, key);
          if (parsed.kind === "incomplete" || busy) return;
          if (editor) {
            if (parsed.kind === "arrow") {
              if (parsed.direction === "left") editor.cursor = Math.max(0, editor.cursor - 1);
              if (parsed.direction === "right")
                editor.cursor = Math.min(editor.draft.length, editor.cursor + 1);
            } else if (parsed.key.name === "return" || parsed.key.name === "enter") {
              try {
                const request: FrameRequest =
                  editor.kind === "frame"
                    ? { kind: "frame", frameNumber: parseFrameNumber(editor.draft) }
                    : { kind: "time", timeMs: parseFrameTime(editor.draft, options.durationMs) };
                void resolveRequest(request).catch(fail);
                return;
              } catch (error) {
                notice = (error as Error).message;
              }
            } else if (parsed.key.name === "backspace") {
              if (editor.cursor > 0) {
                editor.draft =
                  editor.draft.slice(0, editor.cursor - 1) + editor.draft.slice(editor.cursor);
                editor.cursor--;
              }
            } else if (parsed.key.name === "delete") {
              editor.draft =
                editor.draft.slice(0, editor.cursor) + editor.draft.slice(editor.cursor + 1);
            } else if (parsed.key.name === "home") editor.cursor = 0;
            else if (parsed.key.name === "end") editor.cursor = editor.draft.length;
            else if (
              parsed.str &&
              !parsed.key.ctrl &&
              !parsed.key.meta &&
              !/\p{Cc}/u.test(parsed.str)
            ) {
              editor.draft =
                editor.draft.slice(0, editor.cursor) +
                parsed.str +
                editor.draft.slice(editor.cursor);
              editor.cursor += parsed.str.length;
              notice = "";
            }
          } else {
            const layout = layoutFor(options, state);
            if (
              parsed.kind === "arrow" &&
              (parsed.direction === "left" || parsed.direction === "right")
            ) {
              state = moveFrameCandidate(
                state,
                options.durationMs!,
                layout.positions,
                parsed.direction,
              );
            } else if (parsed.kind === "keypress") {
              const letter = parsed.str?.toLowerCase();
              if (letter === "a")
                state = { ...state, glyphs: state.glyphs === "unicode" ? "ascii" : "unicode" };
              else if (letter === "f" || letter === "t")
                editor = { kind: letter === "f" ? "frame" : "time", draft: "", cursor: 0 };
              else if (parsed.key.name === "return" || parsed.key.name === "enter") {
                void resolveRequest(state.request).catch(fail);
                return;
              }
            }
          }
          render();
        } catch (error) {
          fail(error);
        }
      });
      options.output.on("resize", resize);
      options.signal?.addEventListener("abort", interrupt, { once: true });
      if (options.signal?.aborted) interrupt();
      else render();
    } catch (error) {
      parser.dispose();
      fail(error);
    }
  });
}

async function runDirect(
  options: FramePickerOptions,
  state: FramePickerState,
): Promise<WaveOutcome | "retry"> {
  const restoreWave = new AbortController();
  const resize = () => {
    if (layoutFor(options, state).kind !== "direct") restoreWave.abort();
  };
  options.output.on("resize", resize);
  options.output.write(
    `${selectionDetails(state).join("\n")}\nExact count may be unavailable; validate the requested frame during resolution.\n`,
  );
  options.onChange?.({ layout: "direct", state, resolving: false });
  const signal = options.signal
    ? AbortSignal.any([options.signal, restoreWave.signal])
    : restoreWave.signal;
  let choice: "frame" | "time" | "current" | "back";
  try {
    choice = await chooseFrameOption(
      { ...options, signal },
      directPickerTitle(state),
      [
        { name: "Frame number", value: "frame" },
        { name: "Timestamp", value: "time" },
        { name: "Select retained candidate", value: "current" },
        { name: "Back", value: "back" },
      ],
      "back",
    );
  } catch (error) {
    if (restoreWave.signal.aborted && !options.signal?.aborted) return "retry";
    throw error;
  } finally {
    options.output.off("resize", resize);
  }
  if (choice === "back") return { kind: "result", result: null };
  let request = state.request;
  if (choice !== "current") {
    const parse = (value: string): FrameRequest =>
      choice === "frame"
        ? { kind: "frame", frameNumber: parseFrameNumber(value) }
        : { kind: "time", timeMs: parseFrameTime(value, options.durationMs) };
    const value = await enterFrameValue(options, {
      message:
        choice === "frame"
          ? "Source frame (1-based; upper bound verified on resolution)"
          : "Time HH:MM:SS[.mmm]",
      validate: (value) => {
        try {
          parse(value);
          return true;
        } catch (error) {
          return (error as Error).message;
        }
      },
    });
    if (value === undefined) return { kind: "direct", state };
    request = parse(value);
  }
  options.onChange?.({ layout: "direct", state: { ...state, request }, resolving: true });
  try {
    const identity = await runFrameWork(options, "Resolving frame", (signal) =>
      options.resolve(request, signal),
    );
    if (!identity) return { kind: "direct", state };
    if (options.signal?.aborted) throw abortError();
    return {
      kind: "result",
      result: { request, resolved: identity, glyphs: state.glyphs, selection: "custom" },
    };
  } catch (error) {
    if (fatalFrameFailure(error)) throw error;
    if (options.signal?.aborted) throw abortError();
    throw error;
  }
}

export async function promptFramePicker(
  options: FramePickerOptions,
): Promise<FramePickerResult | null> {
  if (!options.input.isTTY || !(options.output as NodeJS.WriteStream).isTTY) {
    throw new Error(
      "Use direct video frames CLI options when no interactive terminal is available.",
    );
  }
  let state = options.initialState ?? { request: { kind: "first" }, glyphs: "unicode" };
  for (;;) {
    if (options.signal?.aborted) throw abortError();
    const useWave =
      supportsRawSessionIO(options.input, options.output) &&
      layoutFor(options, state).kind !== "direct";
    const outcome = useWave ? await runWave(options, state) : await runDirect(options, state);
    if (outcome === "retry") continue;
    if (outcome.kind === "result") return outcome.result;
    state = outcome.state;
  }
}
