import { CliError } from "../errors";
import { ProcessOperation } from "../process/streaming";
import { compare, exact, ticksToMs } from "./exact";
import { inspectVideo } from "./metadata";
import { nextOrdinal, scanVideo, type FrameBackend } from "./scan";
import { inspectSource, type SourceSnapshot } from "./source";
import type {
  FrameRequest,
  FrameTime,
  FrameRecord,
  VideoStream,
  ResolvedFrame,
  FrameSetPreset,
  FrameSetRole,
} from "./types";
const CACHE_RECORDS = 128;
export interface ExportBinding {
  sourcePath: string;
  source: SourceSnapshot;
  stream: VideoStream;
}
interface Context {
  source: SourceSnapshot;
  stream: VideoStream;
}
interface Summary {
  count: number;
  ordered: boolean;
  originTicks?: bigint;
  lastStartMs?: FrameTime;
  endMs?: FrameTime;
}
interface ScanResult {
  first: ResolvedFrame;
  last: ResolvedFrame;
  candidate?: ResolvedFrame;
  summary?: Summary;
}
const timingError = () =>
  new CliError(
    "Presentation timing is missing or not strictly increasing; choose a source frame number.",
    { code: "FRAME_TIMING_UNRELIABLE" },
  );

export class FrameResolver {
  private context?: Context;
  private summary?: Summary;
  private cache = new Map<string, ResolvedFrame>();
  private selections = new WeakMap<ResolvedFrame, Context>();
  private busy = false;
  private unsafe = false;
  private backend: FrameBackend;
  constructor(
    private path: string,
    private options: {
      ffprobe?: string;
      backend?: FrameBackend;
      source?: (path: string) => Promise<SourceSnapshot>;
      progress?: (frames: number) => void;
    } = {},
  ) {
    this.backend = options.backend ?? {
      inspect: (op, source) => inspectVideo(op, source, options.ffprobe),
      scan: (op, source, stream, consume) =>
        scanVideo(op, source, stream, consume, options.ffprobe),
    };
  }
  get state() {
    return {
      cachedIdentities: this.cache.size,
      orderingValidated: this.summary?.ordered ?? false,
      verifiedFrameCount: this.summary?.count,
      endMs: this.summary?.endMs,
      metadata: this.context?.stream,
    };
  }
  private remember(key: string, value: ResolvedFrame) {
    value = Object.freeze({
      ...value,
      startMs: value.startMs ? Object.freeze({ ...value.startMs }) : undefined,
    });
    this.cache.delete(key);
    this.cache.set(key, value);
    this.selections.set(value, this.context!);
    if (this.cache.size > CACHE_RECORDS) this.cache.delete(this.cache.keys().next().value!);
    return value;
  }
  private async operation<T>(
    signal: AbortSignal | undefined,
    body: (operation: ProcessOperation) => Promise<T>,
  ): Promise<T> {
    if (this.unsafe)
      throw new CliError("Previous closure is unconfirmed; stop the flow.", {
        code: "PROCESS_STOP_FAILED",
        exitCode: 2,
      });
    if (this.busy)
      throw new CliError("A frame operation is already active.", { code: "FRAME_OPERATION_BUSY" });
    this.busy = true;
    const operation = new ProcessOperation({ signal });
    try {
      operation.signal.throwIfAborted();
      return await body(operation);
    } catch (error) {
      this.cache.clear();
      this.summary = undefined;
      throw error;
    } finally {
      try {
        await operation.dispose();
      } finally {
        this.unsafe ||= operation.closureUnconfirmed;
        this.busy = false;
      }
    }
  }
  private async check(operation: ProcessOperation, requireExisting = false): Promise<Context> {
    const inspect = this.options.source ?? inspectSource;
    const source = await inspect(this.path);
    operation.signal.throwIfAborted();
    const stream = await this.backend.inspect(operation, source.canonicalPath);
    const after = await inspect(this.path);
    operation.signal.throwIfAborted();
    if (
      source.fingerprint !== after.fingerprint ||
      (this.context &&
        (source.fingerprint !== this.context.source.fingerprint ||
          stream.fingerprint !== this.context.stream.fingerprint))
    ) {
      this.context = undefined;
      this.cache.clear();
      this.summary = undefined;
      throw new CliError("Video source or selected stream changed; select again.", {
        code: "FRAME_SOURCE_CHANGED",
      });
    }
    if (requireExisting && !this.context)
      throw new CliError("Resolve the selected source before export.", {
        code: "FRAME_SELECTION_REQUIRED",
      });
    return (this.context ??= { source, stream });
  }
  async verifyForExport(signal?: AbortSignal): Promise<VideoStream> {
    return this.operation(signal, async (op) => {
      if (!this.cache.size)
        throw new CliError("Resolve a frame before export.", { code: "FRAME_SELECTION_REQUIRED" });
      return (await this.check(op, true)).stream;
    });
  }
  async prepareExport(
    identities: readonly ResolvedFrame[],
    signal?: AbortSignal,
  ): Promise<ExportBinding> {
    return this.operation(signal, async (op) => {
      const context = await this.check(op, true);
      if (
        !identities.length ||
        identities.some((identity) => this.selections.get(identity) !== context)
      )
        throw new CliError("Resolve every selected frame again before export.", {
          code: "FRAME_SELECTION_REQUIRED",
        });
      return Object.freeze({
        sourcePath: this.path,
        source: context.source,
        stream: context.stream,
      });
    });
  }
  async prepareSequence(signal?: AbortSignal): Promise<ExportBinding> {
    return this.operation(signal, async (op) => {
      const context = await this.check(op);
      return Object.freeze({
        sourcePath: this.path,
        source: context.source,
        stream: context.stream,
      });
    });
  }
  private async scan(
    operation: ProcessOperation,
    context: Context,
    request: FrameRequest,
    requireEof = false,
  ): Promise<ScanResult> {
    const { source, stream } = context;
    let count = 0,
      origin: bigint | undefined,
      previous: bigint | undefined,
      ordered = true;
    let first: ResolvedFrame | undefined,
      last: ResolvedFrame | undefined,
      candidate: ResolvedFrame | undefined;
    let lastDuration: bigint | undefined,
      lastProgress = -Infinity;
    const canStop = !requireEof && request.kind === "time" && this.summary?.ordered;
    const previousOrigin = this.summary?.originTicks;
    const result = await this.backend.scan(
      operation,
      source.canonicalPath,
      stream,
      (frame: FrameRecord) => {
        operation.signal.throwIfAborted();
        count = nextOrdinal(count);
        if (frame.streamIndex !== stream.index)
          throw new CliError("Selected frame stream changed.", { code: "FRAME_STREAM_CHANGED" });
        if (count === 1) origin = frame.startTicks;
        if (
          frame.startTicks === undefined ||
          origin === undefined ||
          (previous !== undefined && frame.startTicks <= previous)
        )
          ordered = false;
        previous = frame.startTicks;
        const relative =
          origin !== undefined && frame.startTicks !== undefined && frame.startTicks >= origin
            ? ticksToMs(frame.startTicks - origin, stream.timeBase)
            : undefined;
        const identity: ResolvedFrame = {
          frameNumber: count,
          streamIndex: stream.index,
          startTicks: frame.startTicks,
          startMs: relative,
        };
        first ??= identity;
        last = identity;
        lastDuration = frame.durationTicks;
        if (performance.now() - lastProgress >= 500) {
          this.options.progress?.(count);
          lastProgress = performance.now();
        }
        if (
          request.kind === "first" ||
          (request.kind === "frame" && count === request.frameNumber)
        ) {
          candidate = identity;
          return false;
        }
        if (request.kind === "time") {
          if (relative && compare(relative, request.timeMs) <= 0) candidate = identity;
          if (canStop) {
            if (!ordered || origin !== previousOrigin) throw timingError();
            if (relative && compare(relative, request.timeMs) > 0) return false;
          }
        }
      },
    );
    if (!first || !last)
      throw new CliError("Selected video has no displayed frames.", { code: "FRAME_EMPTY" });
    await this.check(operation);
    this.options.progress?.(count);
    let summary: Summary | undefined;
    if (result.cleanEof) {
      let endMs: FrameTime | undefined;
      if (ordered && origin !== undefined && last.startTicks !== undefined) {
        if (lastDuration !== undefined && lastDuration > 0n)
          endMs = ticksToMs(last.startTicks + lastDuration - origin, stream.timeBase);
        // A selected-stream end is corroborated only by its final decoded display duration.
        // Container duration and nominal rates never fill a missing tail duration.
      }
      summary = { count, ordered, originTicks: origin, lastStartMs: last.startMs, endMs };
      this.summary = summary;
    }
    return { first, last, candidate, summary };
  }
  private validateTime(target: FrameTime, summary: Summary) {
    if (!summary.ordered) throw timingError();
    if (summary.endMs) {
      if (compare(target, summary.endMs) >= 0)
        throw new CliError("Timestamp must be before the verified video end.", {
          code: "FRAME_OUT_OF_RANGE",
        });
    } else if (!summary.lastStartMs || compare(target, summary.lastStartMs) >= 0)
      throw new CliError("Final display end is unavailable; choose a frame number or Last.", {
        code: "FRAME_END_UNRELIABLE",
      });
  }
  async resolve(request: FrameRequest, signal?: AbortSignal): Promise<ResolvedFrame> {
    if (
      request.kind === "frame" &&
      (!Number.isSafeInteger(request.frameNumber) || request.frameNumber < 1)
    )
      throw new CliError("Frame number must be a positive safe integer.", {
        code: "FRAME_NUMBER_INVALID",
      });
    if (request.kind === "time") {
      const time = exact(request.timeMs.numerator, request.timeMs.denominator);
      if (time.numerator < 0n)
        throw new CliError("Frame time cannot be negative.", { code: "FRAME_TIME_INVALID" });
      request = { kind: "time", timeMs: time };
    }
    const key =
      request.kind === "time"
        ? `time:${request.timeMs.numerator}/${request.timeMs.denominator}`
        : request.kind === "frame"
          ? `frame:${request.frameNumber}`
          : request.kind;
    return this.operation(signal, async (operation) => {
      const context = await this.check(operation);
      const cached = this.cache.get(key);
      if (cached) return this.remember(key, cached);
      if (request.kind === "time" && this.summary?.ordered)
        this.validateTime(request.timeMs, this.summary);
      const result = await this.scan(operation, context, request);
      let identity: ResolvedFrame | undefined;
      if (request.kind === "last") {
        if (!result.summary)
          throw new CliError("Last requires clean EOF.", { code: "FRAME_EOF_REQUIRED" });
        identity = result.last;
      } else if (request.kind === "time") {
        const summary = result.summary ?? this.summary;
        if (!summary) throw timingError();
        this.validateTime(request.timeMs, summary);
        identity = result.candidate;
      } else identity = result.candidate;
      if (!identity)
        throw new CliError("Source frame is outside the verified range.", {
          code: "FRAME_OUT_OF_RANGE",
        });
      return this.remember(key, identity);
    });
  }
  async resolveSet(preset: FrameSetPreset, signal?: AbortSignal): Promise<FrameSetRole[]> {
    if (preset !== "first-last" && preset !== "first-middle-last")
      throw new CliError("Unknown frame-set preset.", { code: "FRAME_PRESET_INVALID" });
    return this.operation(signal, async (operation) => {
      const context = await this.check(operation);
      const estimatedEnd = this.summary?.endMs ?? context.stream.estimatedDurationMs;
      const provisional = estimatedEnd
        ? exact(estimatedEnd.numerator, estimatedEnd.denominator * 2n)
        : undefined;
      const firstPass = await this.scan(
        operation,
        context,
        preset === "first-middle-last" && provisional
          ? { kind: "time", timeMs: provisional }
          : { kind: "last" },
        true,
      );
      const summary = firstPass.summary;
      if (!summary)
        throw new CliError("Frame sets require clean EOF.", { code: "FRAME_EOF_REQUIRED" });
      const roles: FrameSetRole[] = [
        { selection: "first", identity: this.remember("first", firstPass.first) },
      ];
      if (preset === "first-middle-last") {
        if (!summary.ordered) throw timingError();
        if (!summary.endMs)
          throw new CliError("Frame-set midpoint needs a reliable display end.", {
            code: "FRAME_END_UNRELIABLE",
          });
        const midpoint = exact(summary.endMs.numerator, summary.endMs.denominator * 2n);
        const candidate =
          provisional && compare(provisional, midpoint) === 0
            ? firstPass.candidate
            : (await this.scan(operation, context, { kind: "time", timeMs: midpoint })).candidate;
        if (!candidate) throw timingError();
        roles.push({
          selection: "middle",
          identity: this.remember(`time:${midpoint.numerator}/${midpoint.denominator}`, candidate),
          targetMs: midpoint,
        });
      }
      roles.push({ selection: "last", identity: this.remember("last", firstPass.last) });
      return roles;
    });
  }
}
