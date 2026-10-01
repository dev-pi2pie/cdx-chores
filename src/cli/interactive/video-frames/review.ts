import type { PreparedVideoFrames } from "../../actions/video-frames";
import { displayPath } from "../../actions/shared";
import type { CliRuntime } from "../../types";
import { FrameNamer } from "../../video-frames/naming";
import { describeFrameRequest, formatFrameTime, type FramePickerState } from "./selection";
import { wrapPickerLine } from "./layout";
import { frameQualityLabel } from "./settings-values";

export function frameReviewLines(
  runtime: CliRuntime,
  prepared: PreparedVideoFrames,
  picker?: FramePickerState,
): string[] {
  const { options } = prepared;
  const stream = prepared.resolver.state.metadata!;
  const lines = [
    "Frame export review",
    `Source: ${displayPath(runtime, options.source)}`,
    `Stream: ${stream.index} (${stream.codec})`,
    `Mode: ${options.mode}`,
    `Image: ${options.image.format} / ${options.image.quality} · Scale: ${options.image.scale}`,
    `Quality: ${frameQualityLabel(options.image.format, options.image.quality)}`,
    `Dimensions: ${prepared.plan.width} × ${prepared.plan.height}`,
    `Destination: ${displayPath(runtime, prepared.destination.path)}`,
    `Overwrite: ${options.overwrite ? "replace conflicting images" : "preserve existing images"}`,
  ];
  if (picker) lines.push(`Requested: ${describeFrameRequest(picker.request)}`);
  if (options.cadence) {
    lines.push(
      `Cadence: ${options.cadence.value}${options.cadence.kind === "fps" ? " FPS" : " interval"}`,
    );
    lines.push(
      prepared.estimatedCount === undefined
        ? "Estimated images: unavailable"
        : `Expected images: ${prepared.estimatedCount} (duration-based estimate)`,
    );
    const namer = new FrameNamer("sequence", options.source, options.naming);
    lines.push(
      `Naming: ${namer.settings.template} · Serial start ${namer.serial.start}, minimum width ${namer.serial.width}`,
    );
    // A template containing {frame} needs decoded identities, never metadata-derived ordinals.
    if (!namer.settings.template.includes("{frame}")) {
      lines.push(
        `First filename: ${namer.name({ frameNumber: 1, format: options.image.format, index: 0 })}`,
      );
      if (
        prepared.estimatedCount !== undefined &&
        prepared.estimatedCount > 1n &&
        prepared.estimatedCount <= BigInt(Number.MAX_SAFE_INTEGER)
      )
        lines.push(
          `Expected last filename: ${namer.name({ frameNumber: 1, format: options.image.format, index: Number(prepared.estimatedCount - 1n) })}`,
        );
    } else lines.push("Source {frame} numbers will be resolved during export.");
  } else
    for (let i = 0; i < prepared.selections.length; i++) {
      const selection = prepared.selections[i]!,
        actual = selection.identity.startMs;
      lines.push(
        `${selection.selection}: frame ${selection.identity.frameNumber} · start ${actual === undefined ? "unavailable" : formatFrameTime(actual)} · ${prepared.names[i]}`,
      );
      if (actual && actual.numerator % actual.denominator !== 0n)
        lines.push(
          `Exact start: ${actual.numerator}/${actual.denominator} ms (displayed clock truncated).`,
        );
    }
  lines.push(...prepared.notices.map((notice) => `Tip: ${notice}`));
  return lines;
}
export function printFrameReview(
  runtime: CliRuntime,
  prepared: PreparedVideoFrames,
  picker?: FramePickerState,
) {
  const columns = (runtime.stdout as NodeJS.WriteStream).columns;
  const width = Number.isSafeInteger(columns) ? Math.max(1, columns - 1) : 79;
  for (const line of frameReviewLines(runtime, prepared, picker))
    runtime.stdout.write(`${wrapPickerLine(line, width).join("\n")}\n`);
}
export function frameReviewTitle(prepared: PreparedVideoFrames): string {
  const { options, plan } = prepared;
  const selection = options.cadence
    ? `${options.cadence.value}${options.cadence.kind === "fps" ? " FPS" : " interval"}`
    : prepared.selections.map(({ identity }) => `F${identity.frameNumber}`).join(", ");
  return `Export ${options.image.format.toUpperCase()}/${options.image.quality} ${plan.width}×${plan.height} · ${selection}?`;
}
