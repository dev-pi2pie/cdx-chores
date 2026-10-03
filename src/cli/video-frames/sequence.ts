import { frameCadence, type FrameCadence } from "./cadence";
import { frameDestination } from "./destination";
import {
  exportImageGroups,
  revalidateBinding,
  type ExportOptions,
  type ImageExportResult,
} from "./export";
import { imageOptions } from "./image-options";
import { FrameNamer, type FrameNamingSettings } from "./naming";
import { FrameResolver } from "./resolver";
import { nextOrdinal, scanVideo } from "./scan";
import { ForwardSampler } from "./sampler";
import type { FrameTime } from "./types";
export interface SequenceOptions extends Omit<ExportOptions, "folder"> {
  fps?: unknown;
  interval?: unknown;
  output?: string;
  naming?: FrameNamingSettings;
  /** Internal bounded-batch verification seam; never a cadence adjustment. */
  groupSize?: number;
}
export interface SequenceResult extends ImageExportResult {
  cadence: FrameCadence;
  sourceFrames: number;
  targets: number;
  endMs: FrameTime;
}
export async function exportFrameSequence(
  resolver: FrameResolver,
  input: SequenceOptions,
): Promise<SequenceResult> {
  const cadence = frameCadence(input),
    settings = imageOptions(input.image);
  const binding = await resolver.prepareSequence(input.signal);
  const namer = new FrameNamer("sequence", binding.sourcePath, input.naming);
  const destination = await frameDestination({
    mode: "sequence",
    source: binding.sourcePath,
    format: settings.format,
    output: input.output,
  });
  let sampler!: ForwardSampler;
  const result = await exportImageGroups(
    binding,
    {
      ...input,
      folder: destination.folder,
      image: settings,
      notices: [
        "Sampling positions may select the same source frame; each position still exports an image.",
        ...(destination.nonempty
          ? [
              "Output folder is nonempty; only requested targets are written and older files can remain. Use a fresh folder for a clean sequence.",
            ]
          : []),
        ...(input.notices ?? []),
      ],
    },
    async (emit, operation, _options, reportActivity) => {
      let ordinal = 0;
      const sampling = () => reportActivity({ phase: "sampling", inspected: ordinal });
      sampling();
      sampler = new ForwardSampler(binding.stream, cadence, {
        emit: async (targets) => {
          await emit(targets);
          sampling();
        },
        groupSize: input.groupSize,
        signal: operation.signal,
        name: (identity, index) =>
          namer.name({ frameNumber: identity.frameNumber, index, format: settings.format }),
      });
      const scan = await scanVideo(
        operation,
        binding.source.canonicalPath,
        binding.stream,
        async (frame) => {
          ordinal = nextOrdinal(ordinal);
          sampling();
          await sampler.record(frame);
        },
        input.ffprobe,
      );
      reportActivity({ phase: "validating" });
      await revalidateBinding(binding, operation, input.ffprobe);
      sampling();
      await sampler.finish(scan.cleanEof);
    },
  );
  return {
    ...result,
    cadence,
    sourceFrames: sampler.sourceFrames,
    targets: sampler.targets,
    endMs: sampler.endMs!,
  };
}
