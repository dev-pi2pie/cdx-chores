import { FenceRange } from "./fence-lines";
import { Container, expandIndent, isParagraph, resolveContainer } from "./list-containers";

// A quote contains another Markdown block sequence. Parse its projected
// lines with the same list rules and map spans back to physical line numbers.
function scope(columns: string[], start: number) {
  let blank = -1;
  const lastBlank = columns.map((line, i) => {
    const previous = blank;
    if (!line.trim()) blank = i;
    return previous;
  });
  return {
    columns,
    start,
    lastBlank,
    fences: new FenceRange(columns, 0, 0),
    owner: new Container(),
  };
}

export class ContainerScopes {
  private constructor(private readonly stack: ReturnType<typeof scope>[]) {}

  static document(lines: string[]) {
    return new ContainerScopes([scope(lines.map(expandIndent), 0)]);
  }

  fork() {
    return new ContainerScopes(
      this.stack.map((frame) => ({ ...frame, owner: frame.owner.fork() })),
    );
  }

  place(index: number, covered: boolean, hasPipe: boolean) {
    let frame = this.stack.at(-1)!;
    while (index >= frame.start + frame.columns.length) {
      this.stack.pop();
      frame = this.stack.at(-1)!;
    }
    for (;;) {
      const local = index - frame.start;
      const blank = frame.lastBlank[local]!;
      const placement = covered
        ? {
            owner: frame.owner,
            relative: frame.columns[local]!,
            marker: false,
            lazy: false,
            literal: false,
          }
        : resolveContainer(frame.owner, frame.columns, local, hasPipe, blank);
      frame.owner = placement.owner;
      const mark =
        !covered &&
        !placement.lazy &&
        !placement.literal &&
        !isParagraph(frame.owner.block) &&
        /^ {0,3}>[ \t]?/.exec(placement.relative);
      if (!mark) return { frame, local, placement, quoted: this.stack.length > 1 };
      const body = frame.owner.quoteBody(
        frame.columns,
        local,
        placement.relative.slice(mark[0].length),
        frame.fences,
        blank,
      );
      frame.owner.block = "boundary";
      frame = scope(body.map(expandIndent), index);
      this.stack.push(frame);
    }
  }
}
