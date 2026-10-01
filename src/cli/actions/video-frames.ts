import { basename } from "node:path";
import { requireCommandAvailable } from "../deps";
import { CliError } from "../errors";
import { ProcessOperation } from "../process/streaming";
import type { CliRuntime } from "../types";
import { expectedSequenceCount } from "../video-frames/cadence";
import { frameDestination } from "../video-frames/destination";
import { inspectImageEncoders, requireImageEncoder } from "../video-frames/encoders";
import { FrameExportError, type ImageExportResult } from "../video-frames/export";
import { imagePlan } from "../video-frames/image-plan";
import { exportFrameImages, type ImageSelection } from "../video-frames/images";
import { FrameNamer } from "../video-frames/naming";
import { validateVideoFramesOptions, type VideoFramesOptions } from "../video-frames/options";
import { FrameResolver } from "../video-frames/resolver";
import { exportFrameSequence } from "../video-frames/sequence";
import { displayPath, printLine } from "./shared";
export type { VideoFramesOptions } from "../video-frames/options";

export interface PreparedVideoFrames {
  options: ReturnType<typeof validateVideoFramesOptions>;
  resolver: FrameResolver;
  selections: readonly ImageSelection[];
  destination: Awaited<ReturnType<typeof frameDestination>>;
  names: readonly string[];
  plan: ReturnType<typeof imagePlan>;
  estimatedCount?: bigint;
  notices: readonly string[];
}
export async function inspectVideoFramesTools(runtime: CliRuntime, signal?: AbortSignal) {
  const operation = new ProcessOperation({ signal });
  const timer = setTimeout(
    () =>
      operation.cancel(
        new CliError("Video tool inspection timed out.", {
          code: "FRAME_TOOL_INSPECTION_TIMEOUT",
          exitCode: 2,
        }),
      ),
    10_000,
  );
  try {
    const runner = async (command: string, args: string[]) => {
      const result = await operation.run(command, args, { outputLimit: 262_144 });
      return { ...result, ok: result.code === 0, stdout: result.stdout.toString("utf8") };
    };
    await requireCommandAvailable("ffmpeg", runtime.platform, runner);
    await requireCommandAvailable("ffprobe", runtime.platform, runner);
    return await inspectImageEncoders(operation);
  } catch (error) {
    if (signal?.aborted && !operation.closureUnconfirmed)
      throw new CliError("Operation cancelled.", { code: "PROCESS_CANCELLED", exitCode: 130 });
    throw error;
  } finally {
    clearTimeout(timer);
    await operation.dispose();
  }
}
/** Read-only preparation; resolved objects stay bound to this resolver through review and export. */
export async function prepareVideoFrames(
  runtime: CliRuntime,
  input: VideoFramesOptions,
  context: {
    resolver?: FrameResolver;
    selections?: readonly ImageSelection[];
    signal?: AbortSignal;
  } = {},
): Promise<PreparedVideoFrames> {
  const options = validateVideoFramesOptions(input, runtime.cwd);
  context.signal?.throwIfAborted();
  requireImageEncoder(await inspectVideoFramesTools(runtime, context.signal), options.image);
  const resolver =
    context.resolver ??
    new FrameResolver(options.source, {
      progress: (frames) =>
        printLine(runtime.stderr, `Scanning: ${frames} source frames inspected.`),
    });
  const selections: readonly ImageSelection[] =
    options.mode === "sequence"
      ? []
      : (context.selections ??
        (options.mode === "set"
          ? await resolver.resolveSet(options.preset!, context.signal)
          : [
              {
                identity: await resolver.resolve(options.request!, context.signal),
                selection:
                  options.request!.kind === "first"
                    ? "first"
                    : options.request!.kind === "last"
                      ? "last"
                      : "custom",
              },
            ]));
  const binding =
    options.mode === "sequence"
      ? await resolver.prepareSequence(context.signal)
      : await resolver.prepareExport(
          selections.map((selection) => selection.identity),
          context.signal,
        );
  const plan = imagePlan(binding.stream, options.image);
  const namer = new FrameNamer(options.mode, options.source, options.naming);
  const generatedNames = selections.map((selection) =>
    namer.name({
      frameNumber: selection.identity.frameNumber,
      format: options.image.format,
      selection: selection.selection,
    }),
  );
  const destination = await frameDestination({
    mode: options.mode,
    source: options.source,
    format: options.image.format,
    output: options.output,
    singleName: generatedNames[0],
    cwd: runtime.cwd,
  });
  const estimatedCount = options.cadence
    ? expectedSequenceCount(
        options.cadence,
        resolver.state.endMs ?? binding.stream.estimatedDurationMs,
      )
    : undefined;
  const notices = [...plan.notices];
  if (binding.stream.eligibleStreams > 1)
    notices.push(`Using video stream ${binding.stream.index} (${binding.stream.codec}).`);
  if (options.mode === "sequence") {
    notices.push(
      "Sampling positions may select the same source frame; each position still exports an image.",
    );
    notices.push(
      estimatedCount === undefined
        ? "Estimated image count is unavailable."
        : `Expected image count: ${estimatedCount} (duration-based estimate).`,
    );
    if (estimatedCount === 1n)
      notices.push("The cadence selects one image for the estimated duration.");
  } else {
    const repeated =
      selections.length -
      new Set(selections.map((selection) => selection.identity.frameNumber)).size;
    if (repeated) notices.push(`The frame set retains ${repeated} repeated selection(s).`);
  }
  if (destination.kind === "folder" && destination.nonempty)
    notices.push(
      "Output folder is nonempty; only requested targets are written and older files can remain. Use a fresh folder for a clean export.",
    );
  return {
    options,
    resolver,
    selections,
    destination,
    names: destination.kind === "file" ? [basename(destination.path)] : generatedNames,
    plan,
    estimatedCount,
    notices,
  };
}
export async function executePreparedVideoFrames(
  runtime: CliRuntime,
  prepared: PreparedVideoFrames,
  signal?: AbortSignal,
): Promise<ImageExportResult> {
  const { options } = prepared;
  for (const notice of prepared.notices) printLine(runtime.stderr, `Tip: ${notice}`);
  printLine(runtime.stderr, "Exporting frame images...");
  let last = -Infinity;
  const progress = (state: { written: number; decoded: number }) => {
    if (Date.now() - last >= 250) {
      last = Date.now();
      printLine(
        runtime.stderr,
        `Exporting: ${state.written} images written, ${state.decoded} source frames decoded.`,
      );
    }
  };
  const common = {
    image: options.image,
    output: options.output,
    naming: options.naming,
    overwrite: options.overwrite,
    signal,
    progress,
  };
  try {
    const result =
      options.mode === "sequence"
        ? await exportFrameSequence(prepared.resolver, {
            ...common,
            ...(options.cadence!.kind === "fps"
              ? { fps: options.cadence!.value }
              : { interval: options.cadence!.value }),
          })
        : await exportFrameImages(prepared.resolver, prepared.selections, {
            ...common,
            mode: options.mode,
          });
    printLine(
      runtime.stdout,
      `Wrote ${result.written} image(s) to ${displayPath(runtime, result.destination)}.`,
    );
    printLine(runtime.stdout, `Repeated selections: ${result.repeatedSelections ?? 0}.`);
    return result;
  } catch (error) {
    if (error instanceof FrameExportError) {
      printLine(
        runtime.stderr,
        `Export incomplete: ${error.result.written} image(s) written to ${displayPath(runtime, error.result.destination)}.`,
      );
      if (error.result.incomplete)
        printLine(
          runtime.stderr,
          `Incomplete output retained: ${displayPath(runtime, error.result.incomplete)}.`,
        );
      if (error.result.retainedStaging)
        printLine(
          runtime.stderr,
          `Staging retained: ${displayPath(runtime, error.result.retainedStaging)}.`,
        );
    }
    throw error;
  }
}
export async function withVideoFramesSignal<T>(
  body: (signal: AbortSignal) => Promise<T>,
  input?: NodeJS.ReadStream,
): Promise<T> {
  const controller = new AbortController();
  const interrupt = () =>
    controller.abort(
      new CliError("Operation cancelled.", { code: "PROCESS_CANCELLED", exitCode: 130 }),
    );
  process.on("SIGINT", interrupt);
  const keypress = (_str: string, key: { ctrl?: boolean; name?: string }) => {
    if (key.ctrl && (key.name === "c" || key.name === "d")) interrupt();
  };
  input?.on("keypress", keypress);
  try {
    return await body(controller.signal);
  } finally {
    process.off("SIGINT", interrupt);
    input?.off("keypress", keypress);
  }
}
export async function actionVideoFrames(
  runtime: CliRuntime,
  options: VideoFramesOptions,
): Promise<ImageExportResult> {
  return withVideoFramesSignal(async (signal) =>
    executePreparedVideoFrames(
      runtime,
      await prepareVideoFrames(runtime, options, { signal }),
      signal,
    ),
  );
}
