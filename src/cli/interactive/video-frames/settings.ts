import { promptPath } from "../../prompts/path";
import { promptPathInlineGhost } from "../../prompts/path-inline";
import type { ImageEncoders } from "../../video-frames/encoders";
import {
  requireImageExtension,
  type ImageFormat,
  type ImageQuality,
} from "../../video-frames/image-options";
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
  initial?: { fps?: string; interval?: string },
): Promise<{ fps?: string; interval?: string } | null> {
  let kind: "fps" | "interval" = initial?.interval ? "interval" : "fps";
  const drafts: Partial<Record<"fps" | "interval", string>> = { ...initial };
  const selectedValues: Partial<Record<"fps" | "interval", string>> = {};
  for (;;) {
    const selectedKind = await chooseFrameOption(
      io,
      "Sequence cadence",
      [
        { name: "Images per second (FPS)", value: "fps" },
        { name: "Time between images (interval)", value: "interval" },
        { name: "Back", value: "back" },
      ],
      "back",
      kind,
    );
    if (selectedKind === "back") return null;
    kind = selectedKind;
    const presets =
      kind === "fps" ? ["24", "25", "30", "60"] : ["500ms", "1s", "2s", "5s", "10s", "30s", "1m"];
    let selected =
      selectedValues[kind] ??
      (drafts[kind] === undefined
        ? presets[0]
        : presets.includes(drafts[kind]!)
          ? drafts[kind]
          : "custom");
    for (;;) {
      selected = await chooseFrameOption(
        io,
        kind === "fps" ? "Images per second" : "Sampling interval",
        [
          ...presets.map((value) => ({
            name: kind === "fps" ? value + " FPS" : "Every " + value,
            description: frameCadenceFeedback(kind, value, duration),
            value,
          })),
          { name: kind === "fps" ? "Custom FPS" : "Custom interval", value: "custom" },
          { name: "Back", value: "back" },
        ],
        "back",
        selected,
      );
      if (selected === "back") break;
      selectedValues[kind] = selected;
      if (selected !== "custom") return { [kind]: selected };
      const defaultValue = drafts[kind] ?? (kind === "fps" ? "24" : "1s");
      const answer = await enterFrameValue(io, {
        message:
          kind === "fps"
            ? "FPS (positive integer or decimal)"
            : "Interval (positive integer + ms, s, or m)",
        default: defaultValue,
        editableDefault: drafts[kind] !== undefined,
        onChange: (value) => {
          drafts[kind] = value;
        },
        validate: (value) => validateFrameCadenceValue(kind, value),
        transformer: (value) => {
          const feedback = frameCadenceFeedback(kind, value || defaultValue, duration);
          return feedback ? value + " - " + feedback : value;
        },
      });
      if (answer !== undefined) return { [kind]: answer };
    }
  }
}

export async function promptFramePath(
  io: FramePromptIO & { simple?: boolean; colorEnabled?: boolean },
  pathContext: InteractivePathPromptContext,
  message: string,
  kind: "file" | "directory",
  imageFormat?: ImageFormat,
  draft?: { initialValue?: string; onChange?: (value: string) => void },
): Promise<string | undefined> {
  const validate = (value: string): true | string => {
    if (!value.trim()) return "Enter a path, or press Escape to go back.";
    if (imageFormat) {
      try {
        requireImageExtension(value, imageFormat);
      } catch (error) {
        return (error as Error).message;
      }
    }
    return true;
  };
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
      initialValue: draft?.initialValue,
      onChange: draft?.onChange,
      promptImpls: {
        advancedInline: (config) =>
          promptPathInlineGhost({ ...config, validate, colorEnabled: io.colorEnabled }),
        simpleInput: async (config) => {
          const answer = await enterFrameValue(io, {
            message: config.message,
            validate,
            default: draft?.initialValue,
            editableDefault: draft?.initialValue !== undefined,
            onChange: draft?.onChange,
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
  let step:
    | "format"
    | "quality"
    | "scale"
    | "scale-value"
    | "destination"
    | "path"
    | "naming"
    | "overwrite" = "format";
  let format = initial?.format ?? "png";
  let quality: ImageQuality = initial?.quality ?? "full";
  const qualities: Partial<Record<ImageFormat, ImageQuality>> = initial
    ? { [initial.format]: initial.quality }
    : {};
  let scale = initial?.scale ?? 1;
  let scaleDraft: string | undefined;
  let scaleChoice = String(scale);
  let destination: FrameImageSettings["destination"] = initial?.destination
    ? { ...initial.destination }
    : { kind: "default" };
  let destinationChoice: "keep" | "default" | "folder" | "file" | "back" = destination.path
    ? "keep"
    : "default";
  const pathDrafts: Partial<Record<"folder" | "file", string>> =
    destination.path && destination.kind !== "default"
      ? { [destination.kind]: destination.path }
      : {};
  let naming = initial?.naming;
  let overwrite = initial?.overwrite ?? false;
  const beforeDestination = () =>
    scaleChoice === "custom" ? ("scale-value" as const) : ("scale" as const);
  const beforeNaming = () =>
    destinationChoice === "folder" || destinationChoice === "file"
      ? ("path" as const)
      : ("destination" as const);
  for (;;) {
    if (step === "format") {
      const value = await chooseFrameOption<ImageFormat | "back">(
        io,
        "Image format",
        [...frameFormatChoices(encoders), { name: "Back", value: "back" }],
        "back",
        format,
      );
      if (value === "back") return null;
      format = value;
      quality = format === "png" ? "full" : (qualities[format] ?? "full");
      step = format === "png" ? "scale" : "quality";
    }
    if (step === "quality") {
      const value = await chooseFrameOption<ImageQuality | "back">(
        io,
        "Image quality",
        [...frameQualityChoices(format, encoders), { name: "Back", value: "back" }],
        "back",
        quality,
      );
      if (value === "back") {
        step = "format";
        continue;
      }
      quality = value;
      qualities[format] = quality;
      step = "scale";
    }
    if (step === "scale") {
      const presets = ["1", "0.75", "0.5", "0.25", "0.1"];
      const scales: FrameSettingChoice<string>[] = presets.map((value) => ({
        name: Number(value) * 100 + "% size",
        value,
      }));
      if (!presets.includes(String(scale)))
        scales.unshift({ name: Number(scale) * 100 + "% size (current)", value: String(scale) });
      const value = await chooseFrameOption(
        io,
        "Output scale",
        [...scales, { name: "Custom scale", value: "custom" }, { name: "Back", value: "back" }],
        "back",
        scaleChoice,
      );
      if (value === "back") {
        step = format === "png" ? "format" : "quality";
        continue;
      }
      scaleChoice = value;
      if (value !== "custom") scale = Number(value);
      step = value === "custom" ? "scale-value" : "destination";
    }
    if (step === "scale-value") {
      const value = await enterFrameValue(io, {
        message: "Scale from 0.1 to 1",
        default: scaleDraft ?? String(scale),
        editableDefault: scaleDraft !== undefined,
        onChange: (value) => {
          scaleDraft = value;
        },
        validate: validateFrameScale,
      });
      if (value === undefined) {
        step = "scale";
        continue;
      }
      scale = Number(value);
      scaleDraft = value;
      step = "destination";
    }
    if (step === "destination") {
      const choices: FrameSettingChoice<"keep" | "default" | "folder" | "file" | "back">[] = [
        ...(destination.path
          ? [
              {
                name: "Keep current " + destination.kind,
                description: destination.path,
                value: "keep" as const,
              },
            ]
          : []),
        { name: "Beside the source", value: "default" },
        { name: "Custom output folder", value: "folder" },
        ...(mode === "single" ? [{ name: "Explicit image file", value: "file" as const }] : []),
        { name: "Back", value: "back" },
      ];
      const choice: "keep" | "default" | "folder" | "file" | "back" = await chooseFrameOption(
        io,
        "Image destination",
        choices,
        "back",
        destinationChoice,
      );
      if (choice === "back") {
        step = beforeDestination();
        continue;
      }
      destinationChoice = choice;
      if (destinationChoice === "default") destination = { kind: "default" };
      step =
        destinationChoice === "file" || destinationChoice === "folder"
          ? "path"
          : destination.kind === "file"
            ? "overwrite"
            : "naming";
    }
    if (step === "path") {
      const kind = destinationChoice === "file" ? "file" : "folder";
      const path = await promptFramePath(
        io,
        pathContext,
        kind === "file" ? "Output image file (." + format + ")" : "Output image folder",
        kind === "file" ? "file" : "directory",
        kind === "file" ? format : undefined,
        {
          initialValue: pathDrafts[kind],
          onChange: (value) => {
            pathDrafts[kind] = value;
          },
        },
      );
      if (path === undefined) {
        step = "destination";
        continue;
      }
      pathDrafts[kind] = path;
      destination = { kind, path };
      step = kind === "file" ? "overwrite" : "naming";
    }
    if (step === "naming") {
      const value = await promptFrameNaming(io, mode, naming);
      if (value === null) {
        step = beforeNaming();
        continue;
      }
      naming = value;
      step = "overwrite";
    }
    const value = await chooseFrameOption(
      io,
      "Existing output images",
      [
        { name: "Keep existing images", description: "Fail on a matching filename", value: "keep" },
        {
          name: "Overwrite matching images",
          description: "Replace matches after encoding completes",
          value: "overwrite",
        },
        { name: "Back", value: "back" },
      ],
      "back",
      overwrite ? "overwrite" : "keep",
    );
    if (value === "back") {
      step = destination.kind === "file" ? beforeNaming() : "naming";
      continue;
    }
    overwrite = value === "overwrite";
    return {
      format,
      quality,
      scale,
      destination,
      ...(destination.kind !== "file" && naming ? { naming } : {}),
      overwrite,
    };
  }
}
