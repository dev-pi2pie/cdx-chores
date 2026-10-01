import { promptPath } from "../../prompts/path";
import type { ImageEncoders } from "../../video-frames/encoders";
import type { ImageFormat, ImageQuality } from "../../video-frames/image-options";
import type { FrameTime } from "../../video-frames/types";
import type { InteractivePathPromptContext } from "../shared";
import { promptFrameNaming, type FrameNamingMode, type FrameNamingSettings } from "./naming";
import { chooseFrameOption, enterFrameValue, type FramePromptIO } from "./simple-prompts";
import {
  frameCadenceFeedback,
  frameFormatChoices,
  frameQualityChoices,
  validateFrameCadenceValue,
  validateFrameScale,
  type FrameSettingChoice,
} from "./settings-values";

export interface FrameImageSettings {
  format: ImageFormat;
  quality: ImageQuality;
  scale: number;
  destination: { kind: "default" | "folder" | "file"; path?: string };
  naming?: FrameNamingSettings;
  overwrite: boolean;
}

export async function promptFrameCadence(
  io: FramePromptIO,
  duration?: FrameTime,
): Promise<{ fps?: string; interval?: string } | null> {
  const kind = await chooseFrameOption(
    io,
    "Sequence cadence",
    [
      { name: "Images per second (FPS)", value: "fps" },
      { name: "Time between images (interval)", value: "interval" },
      { name: "Back", value: "back" },
    ],
    "back",
  );
  if (kind === "back") return null;
  const presets =
    kind === "fps" ? ["24", "25", "30", "60"] : ["500ms", "1s", "2s", "5s", "10s", "30s", "1m"];
  const choices = presets.map((value) => ({
    name: `${kind === "fps" ? `${value} FPS` : `Every ${value}`} - ${frameCadenceFeedback(kind, value, duration)}`,
    value,
  }));
  const selected = await chooseFrameOption(
    io,
    kind === "fps" ? "Images per second" : "Sampling interval",
    [
      ...choices,
      { name: kind === "fps" ? "Custom FPS" : "Custom interval", value: "custom" },
      { name: "Back", value: "back" },
    ],
    "back",
  );
  if (selected === "back") return null;
  let value = selected;
  if (selected === "custom") {
    const defaultValue = kind === "fps" ? "24" : "1s";
    const answer = await enterFrameValue(io, {
      message:
        kind === "fps"
          ? "FPS (positive integer or decimal)"
          : "Interval (positive integer + ms, s, or m)",
      default: defaultValue,
      validate: (value) => validateFrameCadenceValue(kind, value),
      transformer: (value) => {
        const feedback = frameCadenceFeedback(kind, value || defaultValue, duration);
        return feedback ? `${value} - ${feedback}` : value;
      },
    });
    if (answer === undefined) return null;
    value = answer;
  }
  return { [kind]: value };
}

export async function promptFramePath(
  io: FramePromptIO & { simple?: boolean },
  pathContext: InteractivePathPromptContext,
  message: string,
  kind: "file" | "directory",
): Promise<string | undefined> {
  try {
    return await promptPath({
      message,
      kind,
      cwd: pathContext.cwd,
      runtimeConfig: {
        ...pathContext.runtimeConfig,
        ...(io.simple ? { mode: "simple" as const } : {}),
      },
      stdin: io.input,
      stdout: io.output,
      signal: io.signal,
      promptImpls: {
        simpleInput: async (config) => {
          const answer = await enterFrameValue(io, {
            message: config.message,
            validate: (value) =>
              value.trim() ? true : "Enter a path, or press Escape to go back.",
          });
          if (answer === undefined) {
            const error = new Error("User aborted prompt");
            error.name = "ExitPromptError";
            throw error;
          }
          return answer;
        },
      },
    });
  } catch (error) {
    if (!io.signal?.aborted && error instanceof Error && error.name === "ExitPromptError") return;
    throw error;
  }
}

export async function promptFrameImageSettings(
  io: FramePromptIO & { simple?: boolean; colorEnabled?: boolean },
  pathContext: InteractivePathPromptContext,
  mode: FrameNamingMode,
  encoders: ImageEncoders,
  initial?: FrameImageSettings,
): Promise<FrameImageSettings | null> {
  const format = await chooseFrameOption<ImageFormat | "back">(
    io,
    "Image format",
    [...frameFormatChoices(encoders), { name: "Back", value: "back" }],
    "back",
    initial?.format ?? "png",
  );
  if (format === "back") return null;
  const quality =
    format === "png"
      ? "full"
      : await chooseFrameOption<ImageQuality | "back">(
          io,
          "Image quality",
          [...frameQualityChoices(format, encoders), { name: "Back", value: "back" }],
          "back",
          initial?.quality ?? "full",
        );
  if (quality === "back") return null;
  const initialScale = initial?.scale ?? 1;
  const scalePresets = ["1", "0.75", "0.5", "0.25", "0.1"];
  const scales: FrameSettingChoice<string>[] = scalePresets.map((value) => ({
    name: `${value} (${Number(value) * 100}% size)`,
    value,
  }));
  if (!scalePresets.includes(String(initialScale)))
    scales.unshift({ name: `${initialScale} (current scale)`, value: String(initialScale) });
  const scaleChoice = await chooseFrameOption(
    io,
    "Output scale",
    [...scales, { name: "Custom scale", value: "custom" }, { name: "Back", value: "back" }],
    "back",
    String(initialScale),
  );
  if (scaleChoice === "back") return null;
  const scaleValue =
    scaleChoice === "custom"
      ? await enterFrameValue(io, {
          message: "Scale from 0.1 to 1",
          default: String(initialScale),
          validate: validateFrameScale,
        })
      : scaleChoice;
  if (scaleValue === undefined) return null;
  const destinationChoices: FrameSettingChoice<"keep" | "default" | "folder" | "file" | "back">[] =
    [
      ...(initial?.destination.path
        ? [
            {
              name: `Keep current ${initial.destination.kind}: ${initial.destination.path}`,
              value: "keep" as const,
            },
          ]
        : []),
      { name: "Default destination beside the source", value: "default" },
      { name: "Custom output folder", value: "folder" },
      ...(mode === "single" ? [{ name: "Explicit image file", value: "file" as const }] : []),
      { name: "Back", value: "back" },
    ];
  const destinationChoice = await chooseFrameOption(
    io,
    "Image destination",
    destinationChoices,
    "back",
    initial?.destination.path ? "keep" : "default",
  );
  if (destinationChoice === "back") return null;
  let destination: FrameImageSettings["destination"];
  if (destinationChoice === "keep") destination = { ...initial!.destination };
  else if (destinationChoice === "default") destination = { kind: "default" };
  else {
    const path = await promptFramePath(
      io,
      pathContext,
      destinationChoice === "file" ? `Output image file (.${format})` : "Output image folder",
      destinationChoice === "file" ? "file" : "directory",
    );
    if (path === undefined) return null;
    destination = { kind: destinationChoice, path };
  }
  const naming =
    destination.kind === "file" ? undefined : await promptFrameNaming(io, mode, initial?.naming);
  if (naming === null) return null;
  const overwrite = await chooseFrameOption(
    io,
    "Existing output images",
    [
      { name: "Keep existing images; fail on a matching filename", value: "keep" },
      { name: "Overwrite matching images after encoding completes", value: "overwrite" },
      { name: "Back", value: "back" },
    ],
    "back",
    initial?.overwrite ? "overwrite" : "keep",
  );
  if (overwrite === "back") return null;
  return {
    format,
    quality,
    scale: Number(scaleValue),
    destination,
    ...(naming ? { naming } : {}),
    overwrite: overwrite === "overwrite",
  };
}
