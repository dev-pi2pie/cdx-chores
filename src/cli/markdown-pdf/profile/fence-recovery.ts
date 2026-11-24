import { ATX_HEADING, isPipeTableSeparator, type Container } from "./list-containers";
import type { HtmlRecovery } from "./source-cursor";

export interface MatchedFence {
  owner: Container;
  continued: boolean;
  open: number;
  close: number;
  language: string | null;
}

export type SourceEvent = MatchedFence | { index: number; line: string };
interface OffsetRange {
  start: number;
  end: number;
}
interface FenceBody extends OffsetRange {
  precedingStructure: number;
}

// Read ahead only as far as the delimiter being queried. Recovering an
// abandoned opener keeps these spans available to the ordinary scan. Accepting
// a genuine close discards decisions made inside the now-literal HTML.
export class FenceLookahead implements HtmlRecovery {
  readonly candidates = new Map<number, MatchedFence>();
  private readonly bodies: FenceBody[] = [];
  private readonly nextOutside = new Map<number, number>();
  private through = -1;
  private precedingStructure?: number;
  needsRestart = false;

  constructor(
    private readonly positions: OffsetRange[],
    private events: Iterator<SourceEvent>,
  ) {}

  restart(events: Iterator<SourceEvent>) {
    this.events = events;
    this.through = -1;
    this.precedingStructure = undefined;
    this.candidates.clear();
    this.bodies.length = 0;
    this.nextOutside.clear();
    this.needsRestart = false;
  }

  private bodyAt(delimiter: number) {
    while (this.through < delimiter) {
      const event = this.events.next();
      if (event.done) {
        this.through = Infinity;
        break;
      }
      const value = event.value;
      if ("line" in value) {
        const position = this.positions[value.index]!;
        this.through = position.end;
        if (ATX_HEADING.test(value.line) || isPipeTableSeparator(value.line)) {
          this.precedingStructure = position.start;
        }
      } else {
        this.candidates.set(value.open, value);
        this.through = this.positions[value.close]!.end;
        if (this.precedingStructure !== undefined) {
          this.bodies.push({
            start: this.positions[value.open + 1]!.start,
            end: this.positions[value.close]!.start,
            precedingStructure: this.precedingStructure,
          });
        }
      }
    }
    let low = 0;
    let high = this.bodies.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (this.bodies[middle]!.end <= delimiter) low = middle + 1;
      else high = middle;
    }
    const body = this.bodies[low];
    return body && delimiter >= body.start ? body : undefined;
  }

  matchingEnd(
    start: number,
    first: OffsetRange,
    next: (offset: number) => OffsetRange | undefined,
  ) {
    let close: OffsetRange | undefined = first;
    const skipped: number[] = [];
    while (close) {
      const body = this.bodyAt(close.start);
      if (!body || start >= body.precedingStructure) break;
      skipped.push(close.start);
      close = next(this.nextOutside.get(close.start) ?? body.end);
    }
    for (const offset of skipped) this.nextOutside.set(offset, close?.start ?? Infinity);
    return close;
  }
}
