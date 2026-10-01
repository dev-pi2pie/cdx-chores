import { promptTextWithGhost } from "../../prompts/text-inline";
import { resolvePathPromptRuntimeConfig } from "../../prompts/path-config";
import { chooseFrameOption, enterFrameValue, type FramePromptIO } from "./simple-prompts";

import {
  FRAME_NAME_DEFAULTS as defaults,
  validateFrameTemplate,
  effectiveFrameSerial,
  type FrameNamingMode,
  type FrameNamingSettings,
} from "../../video-frames/naming";
import type { FrameSetPreset } from "../../video-frames/types";
export { validateFrameTemplate, effectiveFrameSerial };
export type { FrameNamingMode, FrameNamingSettings, FrameSetPreset };

export async function promptFrameSetPreset(io: FramePromptIO): Promise<FrameSetPreset | null> {
  const value = await chooseFrameOption(
    io,
    "Choose a frame set",
    [
      { name: "First + Last (2 images)", value: "first-last" },
      { name: "First + Middle + Last (3 images)", value: "first-middle-last" },
      { name: "Back", value: "back" },
    ],
    "back",
  );
  return value === "back" ? null : value;
}

export async function promptFrameNaming(
  io: FramePromptIO & { simple?: boolean; colorEnabled?: boolean },
  mode: FrameNamingMode,
  initial?: FrameNamingSettings,
): Promise<FrameNamingSettings | null> {
  const choice = await chooseFrameOption(
    io,
    "Image naming",
    [
      ...(initial ? [{ name: `Keep current: ${initial.template}`, value: "keep" as const }] : []),
      { name: `Default: ${defaults[mode]}`, value: "default" },
      { name: "Custom template", value: "custom" },
      { name: "Back", value: "back" },
    ],
    "back",
    initial ? "keep" : "default",
  );
  if (choice === "back") return null;
  if (choice === "keep") return { ...initial! };
  let template = defaults[mode];
  if (choice === "custom") {
    try {
      template = await promptTextWithGhost({
        message: "Filename template",
        ghostText: defaults[mode],
        initialValue: initial?.template,
        completionKind:
          mode === "single" ? "video-frame" : mode === "set" ? "video-frame-set" : "video-sequence",
        helpLines: [
          mode === "sequence"
            ? "Tokens: {stem}, {frame}, exactly one {serial...}."
            : `Tokens: {stem}, {selection}, {frame}.${mode === "set" ? " {selection} is required." : ""}`,
        ],
        stdin: io.input,
        stdout: io.output,
        colorEnabled: io.colorEnabled,
        signal: io.signal,
        runtimeConfig: {
          ...resolvePathPromptRuntimeConfig(),
          ...(io.simple ? { mode: "simple" as const } : {}),
        },
        validate: (value) => validateFrameTemplate(mode, value),
        promptImpls: {
          simpleInput: async (config) => {
            const value = await enterFrameValue(io, {
              message: config.message,
              default: initial?.template ?? template,
              validate: (value) => validateFrameTemplate(mode, value),
            });
            if (value === undefined) {
              const error = new Error("User aborted prompt");
              error.name = "ExitPromptError";
              throw error;
            }
            return value;
          },
        },
      });
    } catch (error) {
      if (!io.signal?.aborted && error instanceof Error && error.name === "ExitPromptError")
        return null;
      throw error;
    }
  }
  const settings: FrameNamingSettings = { template };
  if (mode === "sequence") {
    const effective = effectiveFrameSerial({
      ...settings,
      serialStart: initial?.serialStart,
      serialWidth: initial?.serialWidth,
    });
    const start = await enterFrameValue(io, {
      message: "Serial start",
      default: String(effective.start),
      validate: (value) =>
        /^\d+$/.test(value) && Number.isSafeInteger(Number(value))
          ? true
          : "Enter a non-negative safe integer.",
    });
    if (start === undefined) return null;
    const width = await enterFrameValue(io, {
      message: "Minimum serial width (digits)",
      default: String(effective.width),
      validate: (value) =>
        /^\d+$/.test(value) &&
        Number.isSafeInteger(Number(value)) &&
        Number(value) > 0 &&
        Number(value) <= 250
          ? true
          : "Enter a positive digit count within filename limits.",
    });
    if (width === undefined) return null;
    settings.serialStart = Number(start);
    settings.serialWidth = Number(width);
  }
  return settings;
}
