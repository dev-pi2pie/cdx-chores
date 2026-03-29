const ESC = String.fromCodePoint(0x1b);
const ESCAPE_SEQUENCE_PATTERN = new RegExp(`^${ESC}\\[([0-9;?]*)([A-Za-z])`);

export class VirtualTerminal {
  private readonly columns: number;
  private readonly lines: string[][];
  private row = 0;
  private column = 0;
  private pendingWrap = false;
  private savedState:
    | {
        row: number;
        column: number;
        pendingWrap: boolean;
      }
    | undefined;

  constructor(columns: number, rows = 24) {
    this.columns = columns;
    this.lines = Array.from({ length: rows }, () => Array(columns).fill(" "));
  }

  write(text: string): void {
    for (let index = 0; index < text.length; index += 1) {
      const next = text[index];
      if (typeof next !== "string") {
        continue;
      }
      if (next === "\x1b" && text[index + 1] === "7") {
        this.savedState = {
          row: this.row,
          column: this.column,
          pendingWrap: this.pendingWrap,
        };
        index += 1;
        continue;
      }
      if (next === "\x1b" && text[index + 1] === "8") {
        if (this.savedState) {
          this.row = this.savedState.row;
          this.column = this.savedState.column;
          this.pendingWrap = this.savedState.pendingWrap;
        }
        index += 1;
        continue;
      }
      if (next === "\x1b") {
        this.pendingWrap = false;
        const match = text.slice(index).match(ESCAPE_SEQUENCE_PATTERN);
        if (!match) {
          continue;
        }
        const [, params, code] = match;
        index += match[0].length - 1;
        if (typeof code !== "string") {
          continue;
        }
        this.applyEscape(code, params ?? "");
        continue;
      }

      if (next === "\r") {
        this.pendingWrap = false;
        this.column = 0;
        continue;
      }

      if (next === "\n") {
        this.pendingWrap = false;
        this.row += 1;
        this.ensureRow(this.row);
        this.column = 0;
        continue;
      }

      if (this.pendingWrap) {
        this.row += 1;
        this.ensureRow(this.row);
        this.column = 0;
        this.pendingWrap = false;
      }

      const line = this.lines[this.row];
      if (!line) {
        continue;
      }
      line[this.column] = next;
      if (this.column === this.columns - 1) {
        this.pendingWrap = true;
      } else {
        this.column += 1;
      }
    }
  }

  getVisibleLines(): string[] {
    return this.lines
      .map((line) => line.join("").replace(/\s+$/u, ""))
      .filter((line) => line.length > 0);
  }

  private applyEscape(code: string, params: string): void {
    this.pendingWrap = false;
    const count = Math.max(1, Number.parseInt(params || "1", 10) || 1);
    if (code === "A") {
      this.row = Math.max(0, this.row - count);
      return;
    }
    if (code === "B") {
      this.row += count;
      this.ensureRow(this.row);
      return;
    }
    if (code === "D") {
      this.column = Math.max(0, this.column - count);
      return;
    }
    if (code === "K" && params === "2") {
      this.lines[this.row] = Array(this.columns).fill(" ");
      this.column = 0;
      return;
    }
    if (code === "m") {
      return;
    }
  }

  private ensureRow(row: number): void {
    while (row >= this.lines.length) {
      this.lines.push(Array(this.columns).fill(" "));
    }
  }
}

export function wrapAscii(value: string, columns: number): string[] {
  const lines: string[] = [];
  for (let index = 0; index < value.length; index += columns) {
    lines.push(value.slice(index, index + columns));
  }
  return lines;
}
