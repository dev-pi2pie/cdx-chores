import { getDisplayWidth } from "../text-display-width";
import {
  clearCurrentLine,
  dim,
  moveCursorDown,
  moveCursorLeft,
  moveCursorUp,
} from "./screen";

interface InlinePromptRenderState {
  renderedRows: number;
  cursorRow: number;
}

export interface InlinePromptRenderer {
  clear(): void;
  render(options: { prefixText: string; ghostText: string }): void;
}

function getTerminalColumns(stdout: NodeJS.WritableStream): number | undefined {
  const columns = (stdout as NodeJS.WritableStream & { columns?: number }).columns;
  if (typeof columns !== "number" || !Number.isFinite(columns) || columns <= 0) {
    return undefined;
  }

  return Math.max(1, Math.floor(columns));
}

function getRenderedRows(displayWidth: number, columns: number | undefined): number {
  if (!columns) {
    return 1;
  }

  return Math.max(1, Math.ceil(Math.max(displayWidth, 1) / columns));
}

function getCursorRow(
  displayWidth: number,
  cursorBackColumns: number,
  columns: number | undefined,
): number {
  if (!columns) {
    return 0;
  }

  const prefixWidth = Math.max(0, displayWidth - Math.max(0, cursorBackColumns));
  if (prefixWidth <= 0) {
    return 0;
  }

  return Math.floor((prefixWidth - 1) / columns);
}

function clearInlinePromptFrame(
  stdout: NodeJS.WritableStream,
  state: InlinePromptRenderState | undefined,
): void {
  if (!state) {
    clearCurrentLine(stdout);
    return;
  }

  stdout.write("\r");
  moveCursorUp(stdout, state.cursorRow);

  for (let rowIndex = 0; rowIndex < state.renderedRows; rowIndex += 1) {
    clearCurrentLine(stdout);
    if (rowIndex < state.renderedRows - 1) {
      moveCursorDown(stdout, 1);
      stdout.write("\r");
    }
  }

  stdout.write("\r");
  moveCursorUp(stdout, state.renderedRows - 1);
}

function renderInlinePromptFrame(options: {
  stdout: NodeJS.WritableStream;
  prefixText: string;
  ghostText: string;
  previousState: InlinePromptRenderState | undefined;
}): InlinePromptRenderState {
  clearInlinePromptFrame(options.stdout, options.previousState);

  const columns = getTerminalColumns(options.stdout);
  const cursorBackColumns = getDisplayWidth(options.ghostText);
  const displayText = `${options.prefixText}${options.ghostText}`;
  const renderedGhost = options.ghostText.length > 0 ? dim(options.ghostText) : "";

  options.stdout.write(`${options.prefixText}${renderedGhost}`);
  moveCursorLeft(options.stdout, cursorBackColumns);

  const displayWidth = getDisplayWidth(displayText);

  return {
    renderedRows: getRenderedRows(displayWidth, columns),
    cursorRow: getCursorRow(displayWidth, cursorBackColumns, columns),
  };
}

export function createInlinePromptRenderer(
  stdout: NodeJS.WritableStream,
): InlinePromptRenderer {
  let renderState: InlinePromptRenderState | undefined;

  return {
    clear(): void {
      clearInlinePromptFrame(stdout, renderState);
      renderState = undefined;
    },
    render(options): void {
      renderState = renderInlinePromptFrame({
        stdout,
        prefixText: options.prefixText,
        ghostText: options.ghostText,
        previousState: renderState,
      });
    },
  };
}
