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
class FenceLookahead {
  readonly closes = new Map<number, number>();
  readonly candidates = new Map<number, MatchedFence>();
  private readonly bodies: FenceBody[] = [];
  private readonly nextOutside = new Map<number, number>();
  private through = -1;
  private precedingStructure?: number;
  private readonly events: Iterator<SourceEvent>;
  constructor(
    private readonly positions: OffsetRange[],
    origin: ScanOrigin,
    ignored: ReadonlyMap<string, number>,
  ) {
    this.events = origin(ignored, (start, end) => this.closes.set(start, end));
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

type ReportClose = (start: number, end: number) => void;
export type ScanOrigin = (
  ignored: ReadonlyMap<string, number>,
  reportClose: ReportClose,
) => Iterator<SourceEvent>;

// To decide a comment close, inspect the Markdown visible with that comment
// abandoned. Other HTML kinds still resolve their own closes: a fence hidden
// by a complete textarea cannot protect a delimiter outside that element.
// Each nested lookup excludes another kind, bounding the dependency depth.
export class FenceRecovery implements HtmlRecovery {
  private readonly views = new Map<string, FenceLookahead>();
  needsOrigin = false;

  constructor(
    private readonly positions: OffsetRange[],
    private readonly ignored: ReadonlyMap<string, number>,
    private origin: ScanOrigin,
    private readonly reportClose?: ReportClose,
  ) {}

  insideVerbatim(kind: string, start: number) {
    const outer = this.ignored.get(kind);
    // A nested start tag of the same raw element is literal within the
    // outer element. Earlier, independent regions still close normally.
    return outer !== undefined && start > outer;
  }

  matchingEnd(
    key: string,
    start: number,
    close: OffsetRange,
    next: (offset: number) => OffsetRange | undefined,
  ) {
    const kind = key === "<!--" || key === "-->" ? "comment" : key;
    if (this.ignored.has(kind)) return undefined;
    let view = this.views.get(kind);
    if (!view) {
      view = new FenceLookahead(
        this.positions,
        this.origin,
        new Map(this.ignored).set(kind, start),
      );
      this.views.set(kind, view);
    }
    return view.matchingEnd(start, close, next);
  }

  confirmed(start: number, end: number, crossedStructure: boolean) {
    this.reportClose?.(start, end);
    for (const [kind, view] of this.views) {
      // A different kind's lookahead can already have consumed this same
      // genuine close. Its scanned suffix and delimiter index are still valid.
      if (view.closes.get(start) !== end) {
        this.views.delete(kind);
        this.needsOrigin = true;
      } else view.closes.delete(start);
    }
    this.needsOrigin ||= crossedStructure;
  }

  resume(origin: ScanOrigin) {
    this.origin = origin;
    this.needsOrigin = false;
  }

  candidate(index: number, owner: Container, continued: boolean) {
    for (const view of this.views.values()) {
      const span = view.candidates.get(index);
      if (span && span.continued === continued && sameFenceScope(span.owner, owner)) return span;
    }
  }
}

// HTML can hide a marker seen during candidate discovery. Its raw range can
// be reused only within the same chain of list items.
function sameFenceScope(a: Container | undefined, b: Container | undefined) {
  while (a && b) {
    if (a.startLine !== b.startLine || a.margin !== b.margin || a.kind !== b.kind) return false;
    a = a.parent;
    b = b.parent;
  }
  return a === b;
}
