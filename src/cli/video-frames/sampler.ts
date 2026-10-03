import { CliError } from "../errors";
import { cadenceTarget, type FrameCadence } from "./cadence";
import { compare, ticksToMs } from "./exact";
import type { ImageTarget } from "./export";
import { EXPORT_GROUP_LIMIT } from "./select-filter";
import { nextOrdinal } from "./scan";
import type { FrameRecord, FrameTime, ResolvedFrame, VideoStream } from "./types";
const timingError = () =>
  new CliError("Sequence timing is missing or not strictly increasing.", {
    code: "FRAME_TIMING_UNRELIABLE",
  });
export class ForwardSampler {
  private origin?: bigint;
  private previous?: { identity: ResolvedFrame; duration?: bigint };
  private group: ImageTarget[] = [];
  private finished = false;
  readonly peaks = { targets: 0 };
  sourceFrames = 0;
  targets = 0;
  endMs?: FrameTime;
  constructor(
    private stream: VideoStream,
    readonly cadence: FrameCadence,
    private options: {
      emit: (targets: readonly ImageTarget[]) => Promise<void>;
      name: (identity: ResolvedFrame, index: number) => string;
      groupSize?: number;
      signal?: AbortSignal;
    },
  ) {
    const limit = options.groupSize ?? EXPORT_GROUP_LIMIT;
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > EXPORT_GROUP_LIMIT ||
      cadence.periodMs.numerator <= 0n
    )
      throw new CliError("Invalid bounded sequence configuration.", { code: "FRAME_GROUP_LIMIT" });
  }
  private async flush() {
    if (!this.group.length) return;
    this.options.signal?.throwIfAborted();
    const group = this.group;
    this.group = [];
    await this.options.emit(group);
  }
  private async through(end: FrameTime) {
    const identity = this.previous!.identity;
    while (compare(cadenceTarget(this.cadence, this.targets), end) < 0) {
      this.options.signal?.throwIfAborted();
      if (this.targets >= Number.MAX_SAFE_INTEGER)
        throw new CliError("Sequence image count exceeds the safe integer limit.", {
          code: "FRAME_NUMERIC_LIMIT",
        });
      const name = this.options.name(identity, this.targets);
      this.group.push(Object.freeze({ identity, name }));
      this.targets++;
      this.peaks.targets = Math.max(this.peaks.targets, this.group.length);
      if (this.group.length === (this.options.groupSize ?? EXPORT_GROUP_LIMIT)) await this.flush();
    }
  }
  async record(frame: FrameRecord) {
    this.options.signal?.throwIfAborted();
    if (this.finished || frame.streamIndex !== this.stream.index || frame.startTicks === undefined)
      throw timingError();
    if (this.previous && frame.startTicks <= this.previous.identity.startTicks!)
      throw timingError();
    this.sourceFrames = nextOrdinal(this.sourceFrames);
    this.origin ??= frame.startTicks;
    const startMs = ticksToMs(frame.startTicks - this.origin, this.stream.timeBase);
    if (this.previous) await this.through(startMs);
    this.previous = {
      identity: Object.freeze({
        frameNumber: this.sourceFrames,
        streamIndex: this.stream.index,
        startTicks: frame.startTicks,
        startMs,
      }),
      duration: frame.durationTicks,
    };
  }
  async finish(cleanEof: boolean) {
    if (this.finished) throw timingError();
    this.finished = true;
    if (!cleanEof)
      throw new CliError("Sequence requires clean EOF.", { code: "FRAME_EOF_REQUIRED" });
    if (!this.previous || this.origin === undefined)
      throw new CliError("Selected video has no displayed frames.", { code: "FRAME_EMPTY" });
    if (this.previous.duration === undefined || this.previous.duration <= 0n) {
      // Earlier targets have a later-start boundary even when the final tail is unknown.
      await this.flush();
      throw new CliError("Final display end is unavailable; sequence export is incomplete.", {
        code: "FRAME_END_UNRELIABLE",
      });
    }
    const end = ticksToMs(
      this.previous.identity.startTicks! + this.previous.duration - this.origin,
      this.stream.timeBase,
    );
    if (compare(end, this.previous.identity.startMs!) <= 0) throw timingError();
    await this.through(end);
    await this.flush();
    this.endMs = end;
  }
}
