import { extname, resolve } from "node:path";
import { CliError } from "../errors";
import { frameCadence } from "./cadence";
import { imageOptions } from "./image-options";
import { FrameNamer, FRAME_NAME_DEFAULTS } from "./naming";
import { parseFrameNumber, parseFrameTime } from "./selectors";
import type { FrameRequest, FrameSetPreset } from "./types";

export interface VideoFramesOptions {
  input: string;
  firstFrame?: boolean;
  lastFrame?: boolean;
  frameNumber?: string | number;
  at?: string;
  frameSet?: string;
  fps?: string | number;
  interval?: string;
  format?: string;
  quality?: string;
  scale?: string | number;
  output?: string;
  pattern?: string;
  serialStart?: string | number;
  serialWidth?: string | number;
  overwrite?: boolean;
}
function integer(value: string | number | undefined, label: string): number | undefined {
  if (value === undefined) return;
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)))
    throw new CliError(`${label} must be a safely representable integer.`, {
      code: "FRAME_SERIAL_INVALID",
    });
  return Number(value);
}
export function validateVideoFramesOptions(options: VideoFramesOptions, cwd: string) {
  if (typeof options.input !== "string" || !options.input.trim())
    throw new CliError("Input video is required.", { code: "FRAME_INPUT_INVALID" });
  const methods = [
    options.firstFrame === true,
    options.lastFrame === true,
    options.frameNumber !== undefined,
    options.at !== undefined,
    options.frameSet !== undefined,
    options.fps !== undefined,
    options.interval !== undefined,
  ];
  if (methods.filter(Boolean).length !== 1)
    throw new CliError(
      "Choose exactly one of --first-frame, --last-frame, --frame-number, --at, --frame-set, --fps, or --interval.",
      { code: "FRAME_SELECTION_REQUIRED" },
    );
  const mode =
    options.fps !== undefined || options.interval !== undefined
      ? "sequence"
      : options.frameSet !== undefined
        ? "set"
        : "single";
  let request: FrameRequest | undefined;
  let preset: FrameSetPreset | undefined;
  if (mode === "single") {
    request = options.firstFrame
      ? { kind: "first" }
      : options.lastFrame
        ? { kind: "last" }
        : options.frameNumber !== undefined
          ? { kind: "frame", frameNumber: parseFrameNumber(String(options.frameNumber)) }
          : { kind: "time", timeMs: parseFrameTime(options.at!) };
    if (
      options.pattern !== undefined ||
      options.serialStart !== undefined ||
      options.serialWidth !== undefined
    )
      throw new CliError(
        "Single-frame CLI naming uses --output; template and serial flags are unavailable.",
        { code: "FRAME_NAMING_SCOPE" },
      );
  } else if (mode === "set") {
    if (options.frameSet !== "first-last" && options.frameSet !== "first-middle-last")
      throw new CliError("Frame set must be first-last or first-middle-last.", {
        code: "FRAME_PRESET_INVALID",
      });
    preset = options.frameSet;
  }
  const cadence = mode === "sequence" ? frameCadence(options) : undefined;
  const scale =
    options.scale === undefined
      ? undefined
      : typeof options.scale === "number"
        ? options.scale
        : Number(options.scale);
  const image = imageOptions({ format: options.format, quality: options.quality, scale });
  const source = resolve(cwd, options.input);
  const naming =
    mode === "single"
      ? undefined
      : {
          template: options.pattern ?? FRAME_NAME_DEFAULTS[mode],
          serialStart: integer(options.serialStart, "Serial start"),
          serialWidth: integer(options.serialWidth, "Serial width"),
        };
  new FrameNamer(mode, source, naming);
  if (options.output !== undefined && !options.output.trim())
    throw new CliError("Output path cannot be empty.", { code: "FRAME_TARGET_INVALID" });
  const output = options.output === undefined ? undefined : resolve(cwd, options.output);
  if (mode === "single" && output) {
    const extensions = image.format === "jpg" ? [".jpg", ".jpeg"] : [`.${image.format}`];
    if (!extensions.includes(extname(output).toLowerCase()))
      throw new CliError("Explicit image extension must match the selected format.", {
        code: "FRAME_EXTENSION_INVALID",
      });
  }
  return Object.freeze({
    mode,
    request,
    preset,
    cadence,
    image,
    source,
    output,
    naming,
    overwrite: options.overwrite ?? false,
  });
}
