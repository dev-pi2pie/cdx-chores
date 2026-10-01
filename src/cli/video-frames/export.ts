import { resolve } from "node:path";
import { CliError } from "../errors";
import { ProcessOperation } from "../process/streaming";
import { inspectImageEncoders, requireImageEncoder } from "./encoders";
import { imagePlan } from "./image-plan";
import {
  assertOpaque,
  requireExactWebpPixels,
  encoderArguments,
  imageOptions,
  type ImageOptions,
} from "./image-options";
import { DECODER_PIXELS, inspectVideo, requireClean } from "./metadata";
import { assertImageBasename, PublicationSession, type PublicationIO } from "./publication";
import { RawFrames } from "./raw-frames";
import { frameSelect, EXPORT_GROUP_LIMIT } from "./select-filter";
import { FrameResolver, type ExportBinding } from "./resolver";
import { nextOrdinal, scanVideo } from "./scan";
import { inspectSource } from "./source";
import { ImageStager } from "./staging";
import type { FrameRecord, ResolvedFrame } from "./types";

export { EXPORT_GROUP_LIMIT };
export interface ImageTarget {
  identity: ResolvedFrame;
  name: string;
}
export interface FrameExportProgress {
  written: number;
  /** Selected raw frame extractions, including extraction again in a later group. */
  decoded: number;
  phase?: "sampling" | "validating" | "exporting" | "finishing";
  /** Source records inspected in the current sampling or validation pass. */
  inspected?: number;
  /** Last requested source ordinal for a bounded selection validation pass. */
  inspectionTarget?: number;
}
export type FrameExportActivity = Pick<
  FrameExportProgress,
  "phase" | "inspected" | "inspectionTarget"
>;
export interface ExportOptions {
  folder: string;
  image?: Parameters<typeof imageOptions>[0];
  overwrite?: boolean;
  signal?: AbortSignal;
  ffmpeg?: string;
  ffprobe?: string;
  progress?: (state: FrameExportProgress) => void;
  /** Internal filesystem seam for controlled failure verification. */
  io?: Partial<PublicationIO>;
  /** Internal child-launch observation seam for bounded resource verification. */
  launch?: NonNullable<ConstructorParameters<typeof ProcessOperation>[0]>["launch"];
  /** Preserve planned operator notices in both completed and partial results. */
  notices?: readonly string[];
}
export interface ImageExportResult {
  completed: boolean;
  written: number;
  repeatedSelections?: number;
  destination: string;
  incomplete?: string;
  retainedStaging?: string;
  stopFlow: boolean;
  closureConfirmed: boolean;
  width: number;
  height: number;
  notices: readonly string[];
  peaks: { files: number; bytes: number; rawFrames: number; targets: number };
}
export class FrameExportError extends CliError {
  constructor(
    error: unknown,
    readonly result: ImageExportResult,
  ) {
    super(error instanceof Error ? error.message : String(error), {
      code: error instanceof CliError ? error.code : "FRAME_EXPORT_FAILED",
      exitCode: result.stopFlow ? 2 : error instanceof CliError ? error.exitCode : 2,
    });
    this.cause = error;
  }
}
export function validateImageFrame(
  frame: FrameRecord,
  binding: ExportBinding,
  options: ImageOptions,
) {
  const stream = binding.stream;
  if (
    frame.streamIndex !== stream.index ||
    frame.width !== stream.width ||
    frame.height !== stream.height ||
    !frame.pixelFormat
  )
    throw new CliError("Displayed frame geometry or stream changed.", {
      code: "FRAME_STREAM_CHANGED",
    });
  const actual = imagePlan(
    {
      ...stream,
      pixelFormat: frame.pixelFormat,
      image: { ...frame.image, display: stream.image?.display ?? [] },
    },
    options,
  );
  const expected = imagePlan(stream, options);
  if (
    actual.filters !== expected.filters ||
    actual.width !== expected.width ||
    actual.height !== expected.height
  )
    throw new CliError(
      "Displayed frame color or aspect metadata differs from the inspected source.",
      { code: "FRAME_IMAGE_METADATA_CHANGED" },
    );
}
export async function revalidateBinding(
  binding: ExportBinding,
  operation: ProcessOperation,
  ffprobe?: string,
) {
  const before = await inspectSource(binding.sourcePath);
  const stream = await inspectVideo(operation, before.canonicalPath, ffprobe);
  const after = await inspectSource(binding.sourcePath);
  if (
    before.fingerprint !== binding.source.fingerprint ||
    after.fingerprint !== binding.source.fingerprint ||
    stream.fingerprint !== binding.stream.fingerprint
  )
    throw new CliError("Video source or selected stream changed; select again.", {
      code: "FRAME_SOURCE_CHANGED",
    });
}
async function validateGroup(
  binding: ExportBinding,
  operation: ProcessOperation,
  targets: readonly ImageTarget[],
  options: ImageOptions,
  reportActivity: (activity: FrameExportActivity) => void,
  ffprobe?: string,
) {
  if (!targets.length || targets.length > EXPORT_GROUP_LIMIT)
    throw new CliError("Image group exceeds its bounded capacity.", { code: "FRAME_GROUP_LIMIT" });
  let previous = 0;
  const names = new Set<string>();
  for (const target of targets) {
    assertImageBasename(target.name);
    const key = target.name.normalize("NFC").toLowerCase();
    if (names.has(key))
      throw new CliError("Image selections require distinct output filenames.", {
        code: "FRAME_NAME_COLLISION",
      });
    names.add(key);
    const identity = target.identity;
    if (
      !Number.isSafeInteger(identity.frameNumber) ||
      identity.frameNumber < previous ||
      identity.frameNumber < 1 ||
      identity.streamIndex !== binding.stream.index
    )
      throw new CliError("Image selections must follow verified source order.", {
        code: "FRAME_SELECTION_REQUIRED",
      });
    previous = identity.frameNumber;
  }
  let ordinal = 0,
    selected = 0;
  const inspectionTarget = targets[targets.length - 1]!.identity.frameNumber;
  reportActivity({ phase: "validating", inspected: 0, inspectionTarget });
  await scanVideo(
    operation,
    binding.source.canonicalPath,
    binding.stream,
    (frame) => {
      ordinal = nextOrdinal(ordinal);
      reportActivity({ phase: "validating", inspected: ordinal, inspectionTarget });
      while (targets[selected]?.identity.frameNumber === ordinal) {
        validateImageFrame(frame, binding, options);
        if (frame.startTicks !== targets[selected]!.identity.startTicks)
          throw new CliError("Selected frame identity changed.", { code: "FRAME_SOURCE_CHANGED" });
        selected++;
      }
      if (selected === targets.length) return false;
    },
    ffprobe,
  );
  if (selected !== targets.length)
    throw new CliError("Selected frame is absent from the source.", { code: "FRAME_OUT_OF_RANGE" });
}

/** Shared executor: a producer emits bounded, source-ordered groups, never a full frame table. */
export async function exportImageGroups(
  binding: ExportBinding,
  input: ExportOptions,
  produce: (
    emit: (targets: readonly ImageTarget[]) => Promise<void>,
    operation: ProcessOperation,
    options: ImageOptions,
    reportActivity: (activity: FrameExportActivity) => void,
  ) => Promise<void>,
): Promise<ImageExportResult> {
  const options = imageOptions(input.image);
  const plan = imagePlan(binding.stream, options);
  const operation = new ProcessOperation({ signal: input.signal, launch: input.launch });
  let session: PublicationSession | undefined, writer: ImageStager | undefined;
  let failure: unknown,
    cleanupFailed = false,
    decoded = 0,
    previous = 0,
    repeats = 0;
  const result: ImageExportResult = {
    completed: false,
    written: 0,
    destination: resolve(input.folder),
    stopFlow: false,
    closureConfirmed: true,
    width: plan.width,
    height: plan.height,
    notices: Object.freeze([...plan.notices, ...(input.notices ?? [])]),
    peaks: { files: 0, bytes: 0, rawFrames: 0, targets: 0 },
  };
  let activity: FrameExportActivity = {};
  const progress = (next?: FrameExportActivity) => {
    if (next) activity = next;
    input.progress?.({ written: session?.written ?? 0, decoded, ...activity });
  };
  try {
    operation.signal.throwIfAborted();
    progress({ phase: "validating" });
    await revalidateBinding(binding, operation, input.ffprobe);
    requireImageEncoder(await inspectImageEncoders(operation, input.ffmpeg), options);
    await produce(
      async (targets) => {
        operation.signal.throwIfAborted();
        await validateGroup(binding, operation, targets, options, progress, input.ffprobe);
        progress({ phase: "validating" });
        await revalidateBinding(binding, operation, input.ffprobe);
        if (targets[0]!.identity.frameNumber < previous)
          throw new CliError("Image groups must follow source order.", {
            code: "FRAME_SELECTION_REQUIRED",
          });
        result.peaks.targets = Math.max(result.peaks.targets, targets.length);
        for (const target of targets) {
          if (target.identity.frameNumber === previous) repeats++;
          previous = target.identity.frameNumber;
        }
        session ??= await PublicationSession.create({
          folder: input.folder,
          sourcePath: binding.sourcePath,
          source: binding.source,
          overwrite: input.overwrite,
          signal: operation.signal,
          io: input.io,
          onWritten: () => progress(),
        });
        const unique = targets.filter(
          (target, index) =>
            index === 0 || target.identity.frameNumber !== targets[index - 1]!.identity.frameNumber,
        );
        writer = new ImageStager(
          session,
          options.format,
          (index) => {
            if (!targets[index - 1])
              throw new CliError("Encoder produced extra images.", {
                code: "FRAME_IMAGE_INCOMPLETE",
              });
            return targets[index - 1]!.name;
          },
          { onFailure: (error) => operation.cancel(error) },
        );
        const activeWriter = writer;
        const writtenBefore = session.written;
        let targetIndex = 0;
        progress({ phase: "exporting" });
        const encoded = await operation.run(
          input.ffmpeg ?? "ffmpeg",
          [
            "-v",
            "error",
            "-nostdin",
            "-f",
            "rawvideo",
            "-pixel_format",
            "rgba",
            "-video_size",
            `${plan.width}x${plan.height}`,
            "-framerate",
            "1",
            "-probesize",
            "32",
            "-analyzeduration",
            "0",
            "-i",
            "pipe:0",
            ...encoderArguments(options),
            "-threads",
            "1",
            "-map_metadata",
            "-1",
            "-fps_mode",
            "passthrough",
            "-progress",
            "pipe:3",
            "-f",
            "image2pipe",
            "pipe:1",
          ],
          {
            input: async (write, signal) => {
              const raw = new RawFrames(plan.frameBytes, async (pixels, index) => {
                signal.throwIfAborted();
                if (!unique[index - 1])
                  throw new CliError("Decoder produced extra images.", {
                    code: "FRAME_IMAGE_INCOMPLETE",
                  });
                if (options.format === "jpg") assertOpaque(pixels);
                requireExactWebpPixels(pixels, options);
                result.peaks.rawFrames = 1;
                while (
                  targets[targetIndex]?.identity.frameNumber ===
                  unique[index - 1]!.identity.frameNumber
                ) {
                  for (let offset = 0; offset < pixels.length; offset += 65536)
                    await write(pixels.subarray(offset, Math.min(offset + 65536, pixels.length)));
                  targetIndex++;
                }
                decoded++;
                progress();
              });
              const select = frameSelect(unique.map((target) => target.identity.frameNumber));
              const selectedPlan = imagePlan(binding.stream, options, select);
              const extracted = await operation.run(
                input.ffmpeg ?? "ffmpeg",
                [
                  "-v",
                  "error",
                  "-nostdin",
                  "-xerror",
                  "-err_detect",
                  "explode",
                  "-max_pixels",
                  String(DECODER_PIXELS),
                  "-threads",
                  "1",
                  "-noautorotate",
                  "-display_rotation",
                  "0",
                  "-i",
                  binding.source.canonicalPath,
                  "-filter_complex",
                  selectedPlan.filters,
                  "-map",
                  "[out]",
                  "-an",
                  "-sn",
                  "-dn",
                  "-frames:v",
                  String(unique.length),
                  "-fps_mode",
                  "passthrough",
                  "-pix_fmt",
                  "rgba",
                  "-f",
                  "rawvideo",
                  "pipe:1",
                ],
                { consume: (chunk) => raw.chunk(chunk) },
              );
              requireClean(extracted, "Selected image extraction");
              raw.finish(unique.length);
              if (targetIndex !== targets.length)
                throw new CliError("Selected image count changed.", {
                  code: "FRAME_IMAGE_INCOMPLETE",
                });
            },
            consume: (chunk) => activeWriter.chunk(chunk),
            progress: () => progress(),
          },
        );
        requireClean(encoded, "Image encoder");
        await writer.finish();
        if (session.written - writtenBefore !== targets.length)
          throw new CliError("Encoder image count does not match the selected outputs.", {
            code: "FRAME_IMAGE_INCOMPLETE",
          });
        result.peaks.files = Math.max(result.peaks.files, writer.peaks.files);
        result.peaks.bytes = Math.max(result.peaks.bytes, writer.peaks.bytes);
        progress({ phase: "validating" });
        await revalidateBinding(binding, operation, input.ffprobe);
      },
      operation,
      options,
      progress,
    );
    if (!session) throw new CliError("No images selected.", { code: "FRAME_EMPTY" });
    progress({ phase: "finishing" });
  } catch (error) {
    failure = error;
    operation.cancel(error);
  } finally {
    try {
      await operation.dispose();
    } catch (error) {
      failure = error;
    }
    result.closureConfirmed = !operation.closureUnconfirmed;
    try {
      await writer?.settle();
    } catch (error) {
      failure ??= error;
    }
    if (session) {
      result.written = session.written;
      result.destination = session.root;
      result.incomplete = session.incomplete;
      if (writer) {
        result.peaks.files = Math.max(result.peaks.files, writer.peaks.files);
        result.peaks.bytes = Math.max(result.peaks.bytes, writer.peaks.bytes);
      }
      try {
        await session.cleanup(result.closureConfirmed);
      } catch (error) {
        failure = error;
        cleanupFailed = true;
        result.retainedStaging = session.staging;
      }
    }
    result.stopFlow = !result.closureConfirmed || cleanupFailed;
  }
  if (!failure && (operation.signal.aborted || input.signal?.aborted))
    failure = operation.signal.aborted
      ? operation.signal.reason
      : new CliError("Operation cancelled.", { code: "PROCESS_CANCELLED", exitCode: 130 });
  if (failure) throw new FrameExportError(failure, result);
  result.completed = true;
  result.repeatedSelections = repeats;
  return result;
}
export async function exportResolvedFrames(
  resolver: FrameResolver,
  targets: readonly ImageTarget[],
  options: ExportOptions,
): Promise<ImageExportResult> {
  const binding = await resolver.prepareExport(
    targets.map((target) => target.identity),
    options.signal,
  );
  return exportImageGroups(binding, options, async (emit) => emit(targets));
}
