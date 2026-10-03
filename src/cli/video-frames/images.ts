import { basename, join } from "node:path";
import { CliError } from "../errors";
import { frameDestination } from "./destination";
import {
  exportImageGroups,
  FrameExportError,
  type ExportOptions,
  type ImageExportResult,
} from "./export";
import { imageOptions } from "./image-options";
import { FrameNamer, type FrameNamingSettings } from "./naming";
import { FrameResolver } from "./resolver";
import type { ResolvedFrame } from "./types";
export interface ImageSelection {
  identity: ResolvedFrame;
  selection: "first" | "middle" | "last" | "custom";
}
export interface FrameImagesOptions extends Omit<ExportOptions, "folder"> {
  mode: "single" | "set";
  output?: string;
  naming?: FrameNamingSettings;
}
/** Mode-aware backend entry; callers retain requested labels rather than deriving them from identities. */
export async function exportFrameImages(
  resolver: FrameResolver,
  selections: readonly ImageSelection[],
  input: FrameImagesOptions,
): Promise<ImageExportResult> {
  const labels = selections.map((selection) => selection.selection).join(",");
  if (
    input.mode === "single"
      ? selections.length !== 1 || !["first", "last", "custom"].includes(labels)
      : input.mode !== "set" || !["first,last", "first,middle,last"].includes(labels)
  )
    throw new CliError("Choose one frame or an exact fixed frame-set preset.", {
      code: "FRAME_SELECTION_REQUIRED",
    });
  if (input.mode === "single" && input.output !== undefined && input.naming !== undefined)
    throw new CliError("Explicit image files bypass template settings.", {
      code: "FRAME_NAMING_SCOPE",
    });
  const settings = imageOptions(input.image);
  const binding = await resolver.prepareExport(
    selections.map((selection) => selection.identity),
    input.signal,
  );
  const generated = input.mode !== "single" || input.output === undefined;
  const namer = generated
    ? new FrameNamer(input.mode, binding.sourcePath, input.naming)
    : undefined;
  const names = selections.map((selection) =>
    namer?.name({
      frameNumber: selection.identity.frameNumber,
      format: settings.format,
      selection: selection.selection,
    }),
  );
  const destination = await frameDestination({
    mode: input.mode,
    source: binding.sourcePath,
    format: settings.format,
    output: input.output,
    singleName: input.mode === "single" ? names[0] : undefined,
  });
  const targets = selections.map((selection, index) => ({
    identity: selection.identity,
    name: destination.kind === "file" ? basename(destination.path) : names[index]!,
  }));
  const fileResult = (result: ImageExportResult) => {
    if (destination.kind === "file")
      result.destination = join(result.destination, basename(destination.path));
    return result;
  };
  try {
    return fileResult(
      await exportImageGroups(
        binding,
        {
          ...input,
          image: settings,
          folder: destination.folder,
          notices: [
            ...(input.notices ?? []),
            ...(destination.kind === "folder" && destination.nonempty
              ? [
                  "Output folder is nonempty; only requested targets are written and older files can remain. Use a fresh folder for a clean frame set.",
                ]
              : []),
          ],
        },
        async (emit) => emit(targets),
      ),
    );
  } catch (error) {
    if (error instanceof FrameExportError) fileResult(error.result);
    throw error;
  }
}
