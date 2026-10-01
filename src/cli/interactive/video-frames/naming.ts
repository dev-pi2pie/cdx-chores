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

export async function promptFrameSetPreset(
  io: FramePromptIO,
  initial?: FrameSetPreset,
): Promise<FrameSetPreset | null> {
  const value = await chooseFrameOption(
    io,
    "Choose a frame set",
    [
      { name: "First + Last (2 images)", value: "first-last" },
      { name: "First + Middle + Last (3 images)", value: "first-middle-last" },
      { name: "Back", value: "back" },
    ],
    "back",
    initial,
  );
  return value === "back" ? null : value;
}

export async function promptFrameNaming(
  io: FramePromptIO & { simple?: boolean; colorEnabled?: boolean },
  mode: FrameNamingMode,
  initial?: FrameNamingSettings,
): Promise<FrameNamingSettings | null> {
  let step: "choice" | "template" | "start" | "width" = "choice";
  let choice = initial ? "keep" : "default";
  let template = initial?.template ?? defaults[mode];
  let templateDraft = initial?.template;
  let serialStart = initial?.serialStart === undefined ? undefined : String(initial.serialStart);
  let serialWidth = initial?.serialWidth === undefined ? undefined : String(initial.serialWidth);
  for (;;) {
    if (step === "choice") {
      choice = await chooseFrameOption(
        io,
        "Image naming",
        [
          ...(initial
            ? [{ name: "Keep current template", description: initial.template, value: "keep" }]
            : []),
          { name: "Default template", description: defaults[mode], value: "default" },
          { name: "Custom template", value: "custom" },
          { name: "Back", value: "back" },
        ],
        "back",
        choice,
      );
      if (choice === "back") return null;
      if (choice === "keep") return { ...initial! };
      if (choice === "default") template = defaults[mode];
      step = choice === "custom" ? "template" : "start";
      if (mode !== "sequence" && choice !== "custom") return { template };
    }
    if (step === "template") {
      try {
        template = await promptTextWithGhost({
          message: "Filename template",
          ghostText: defaults[mode],
          initialValue: templateDraft,
          onChange: (value) => {
            templateDraft = value;
          },
          completionKind:
            mode === "single"
              ? "video-frame"
              : mode === "set"
                ? "video-frame-set"
                : "video-sequence",
          helpLines: [
            mode === "sequence"
              ? "Tokens: {stem}, {frame}, exactly one {serial...}."
              : "Tokens: {stem}, {selection}, {frame}." +
                (mode === "set" ? " {selection} is required." : ""),
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
                default: templateDraft ?? template,
                editableDefault: templateDraft !== undefined,
                onChange: (value) => {
                  templateDraft = value;
                },
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
        if (!io.signal?.aborted && error instanceof Error && error.name === "ExitPromptError") {
          step = "choice";
          continue;
        }
        throw error;
      }
      if (mode !== "sequence") return { template };
      step = "start";
    }
    const effective = effectiveFrameSerial({
      template,
      serialStart: initial?.serialStart,
      serialWidth: initial?.serialWidth,
    });
    if (step === "start") {
      const start = await enterFrameValue(io, {
        message: "Serial start",
        default: serialStart ?? String(effective.start),
        editableDefault: serialStart !== undefined,
        onChange: (value) => {
          serialStart = value;
        },
        validate: (value) =>
          /^\d+$/.test(value) && Number.isSafeInteger(Number(value))
            ? true
            : "Enter a non-negative safe integer.",
      });
      if (start === undefined) {
        step = choice === "custom" ? "template" : "choice";
        continue;
      }
      serialStart = start;
      step = "width";
    }
    const width = await enterFrameValue(io, {
      message: "Minimum serial width (digits)",
      default: serialWidth ?? String(effective.width),
      editableDefault: serialWidth !== undefined,
      onChange: (value) => {
        serialWidth = value;
      },
      validate: (value) =>
        /^\d+$/.test(value) &&
        Number.isSafeInteger(Number(value)) &&
        Number(value) > 0 &&
        Number(value) <= 250
          ? true
          : "Enter a positive digit count within filename limits.",
    });
    if (width === undefined) {
      step = "start";
      continue;
    }
    return { template, serialStart: Number(serialStart), serialWidth: Number(width) };
  }
}
