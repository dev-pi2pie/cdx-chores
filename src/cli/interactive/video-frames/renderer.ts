import { moveCursorUp, clearCurrentLine } from "../../tui";
import { getCliColors } from "../../colors";
import type { PickerLayout } from "./layout";
import { getDisplayWidth } from "../../text-display-width";

/** Owns only the prompt's painted lines; callers supply already wrapped text. */
export function createPickerRenderer(output: NodeJS.WritableStream) {
  let painted: string[] = [];
  const clear = () => {
    if (!painted.length) return;
    const columns = (output as NodeJS.WriteStream).columns;
    const rows = painted.reduce(
      (total, line) =>
        total +
        (Number.isSafeInteger(columns) && columns > 0
          ? Math.max(1, Math.ceil(getDisplayWidth(line) / columns))
          : 1),
      0,
    );
    output.write("\r");
    moveCursorUp(output, rows - 1);
    output.write("\x1b[J");
    clearCurrentLine(output);
    painted = [];
  };
  return {
    render(lines: string[], options?: { layout: PickerLayout; colorEnabled: boolean }) {
      clear();
      const colors = getCliColors({ colorEnabled: options?.colorEnabled ?? false }, output);
      const styled = options
        ? lines.map((line) => {
            if (!/^[ │▼▲v|^]+$/u.test(line)) return line;
            const marker = Math.round(
              options.layout.selectedPosition * (options.layout.kind === "full" ? 4 : 2),
            );
            return (
              colors.dim(line.slice(0, marker)) +
              colors.yellow(line[marker] ?? "") +
              colors.dim(line.slice(marker + 1))
            );
          })
        : lines;
      output.write(styled.join("\r\n"));
      painted = lines;
    },
    close() {
      clear();
    },
  };
}
