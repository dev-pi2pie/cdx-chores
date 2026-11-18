import { getDisplayWidth } from "../text-display-width";

/** Own the terminal rows occupied by a redrawable block, including after a shrink. */
export function createReflowingTerminalBlock(terminal: NodeJS.WriteStream) {
  let previous: string[] = [];
  let previousColumns = 80;
  const columns = () =>
    Number.isSafeInteger(terminal.columns) && terminal.columns > 0 ? terminal.columns : 80;

  function clear(): void {
    if (previous.length === 0) return;
    const width = Math.min(previousColumns, columns());
    const rows = previous.reduce(
      (sum, line) => sum + Math.max(1, Math.ceil(getDisplayWidth(line) / width)),
      0,
    );
    const up = rows > 1 ? `\x1b[${rows - 1}A` : "";
    terminal.write(`\r${up}`);
    for (let row = 0; row < rows; row++) {
      terminal.write("\x1b[2K");
      if (row < rows - 1) terminal.write("\x1b[1B\r");
    }
    terminal.write(`\r${up}`);
    previous = [];
  }

  return {
    columns,
    clear,
    render(lines: string[], styled: string) {
      clear();
      terminal.write(styled);
      previous = lines;
      previousColumns = columns();
    },
  };
}
