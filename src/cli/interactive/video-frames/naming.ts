import { promptTextWithGhost } from "../../prompts/text-inline";
import { resolvePathPromptRuntimeConfig } from "../../prompts/path-config";
import { chooseFrameOption, enterFrameValue, type FramePromptIO } from "./simple-prompts";

import {
  FRAME_NAME_DEFAULTS as defaults,
  FrameNamer,
  validateFrameTemplate,
  effectiveFrameSerial,
  type FrameNamingMode,
  type FrameNamingSettings,
} from "../../video-frames/naming";
import type { FrameSetPreset } from "../../video-frames/types";
import type { ImageFormat } from "../../video-frames/image-options";
import type { ImageSelection } from "../../video-frames/images";
export { validateFrameTemplate, effectiveFrameSerial };
export type { FrameNamingMode, FrameNamingSettings, FrameSetPreset };

export interface FrameNamingContext {
  source: string;
  format: ImageFormat;
  selections?: readonly ImageSelection[];
}

export function frameNamingInformation(
  mode: FrameNamingMode,
  settings: FrameNamingSettings,
  context: FrameNamingContext,
): { description: string; compactDescription: string } {
  const namer = new FrameNamer(mode, context.source, settings);
  const description = [
    `Template: ${namer.settings.template}`,
    `Source stem: ${namer.stem}`,
    `Extension: .${context.format}`,
  ];
  const compact = [
    `Template ${namer.settings.template}`,
    `Stem ${namer.stem} · .${context.format}`,
  ];
  if (mode === "sequence") {
    description.push(`Serial start: ${namer.serial.start} · Minimum width: ${namer.serial.width}`);
    compact.splice(
      0,
      compact.length,
      `${namer.settings.template} · Stem ${namer.stem}`,
      `Start ${namer.serial.start} · Width ${namer.serial.width} · .${context.format}`,
    );
  }
  let examples: string[] = [];
  let unresolved: string | undefined;
  if (mode === "sequence" && settings.template.includes("{frame}")) {
    unresolved = "Filename examples await resolved {frame} values";
  } else if (mode !== "sequence" && !context.selections?.length) {
    unresolved = "Filename examples await resolved selections";
  } else {
    try {
      examples =
        mode === "sequence"
          ? // Without {frame}, source ordinals have no effect on these export-order examples.
            [0, 1]
              .filter((index) => index <= Number.MAX_SAFE_INTEGER - namer.serial.start)
              .map((index) => namer.name({ frameNumber: 1, format: context.format, index }))
          : context.selections!.map((selected) =>
              namer.name({
                frameNumber: selected.identity.frameNumber,
                selection: selected.selection,
                format: context.format,
              }),
            );
    } catch (error) {
      unresolved = `Filename example unavailable: ${(error as Error).message}`;
    }
  }
  if (unresolved) {
    description.push(unresolved);
    compact.push(
      mode === "sequence" && settings.template.includes("{frame}")
        ? "{frame} unresolved"
        : unresolved,
    );
  } else {
    description.push(...examples.map((name) => `Example: ${name}`));
    compact.push(`Example ${examples[0]}`);
  }
  return { description: description.join("\n"), compactDescription: compact.join("\n") };
}

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
  context?: FrameNamingContext,
): Promise<FrameNamingSettings | null> {
  let step: "choice" | "template" | "start" | "width" = "choice";
  let choice = initial ? "keep" : "default";
  let template = initial?.template ?? defaults[mode];
  let templateDraft = initial?.template;
  let serialStart = initial?.serialStart === undefined ? undefined : String(initial.serialStart);
  let serialWidth = initial?.serialWidth === undefined ? undefined : String(initial.serialWidth);
  const information = (settings: FrameNamingSettings) =>
    context
      ? frameNamingInformation(mode, settings, context)
      : { description: settings.template, compactDescription: settings.template };
  const finish = (settings: FrameNamingSettings) => {
    if (context) io.output.write(information(settings).description + "\n");
    return settings;
  };
  for (;;) {
    if (step === "choice") {
      choice = await chooseFrameOption(
        io,
        "Image naming",
        [
          ...(initial
            ? [{ name: "Keep current template", ...information(initial), value: "keep" }]
            : []),
          {
            name: "Default template",
            ...information({
              template: defaults[mode],
              ...(mode === "sequence"
                ? {
                    serialStart:
                      /^\d+$/.test(serialStart ?? "") && Number.isSafeInteger(Number(serialStart))
                        ? Number(serialStart)
                        : initial?.serialStart,
                    serialWidth:
                      /^\d+$/.test(serialWidth ?? "") &&
                      Number(serialWidth) > 0 &&
                      Number(serialWidth) <= 250
                        ? Number(serialWidth)
                        : initial?.serialWidth,
                  }
                : {}),
            }),
            value: "default",
          },
          { name: "Custom template", value: "custom" },
          { name: "Back", value: "back" },
        ],
        "back",
        choice,
      );
      if (choice === "back") return null;
      if (choice === "keep") return finish({ ...initial! });
      if (choice === "default") template = defaults[mode];
      step = choice === "custom" ? "template" : "start";
      if (mode !== "sequence" && choice !== "custom") return finish({ template });
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
      if (mode !== "sequence") return finish({ template });
      step = "start";
    }
    const effective = effectiveFrameSerial({
      template,
      serialStart: initial?.serialStart,
      serialWidth: initial?.serialWidth,
    });
    const serialFeedback = (
      field: "serialStart" | "serialWidth",
      value: string,
      fallback: number,
    ) => {
      const draft = value || String(fallback);
      const valid =
        /^\d+$/.test(draft) &&
        Number.isSafeInteger(Number(draft)) &&
        (field === "serialStart" || (Number(draft) > 0 && Number(draft) <= 250));
      if (!context || !valid) return value;
      const settings = {
        template,
        serialStart: /^\d+$/.test(serialStart ?? "") ? Number(serialStart) : effective.start,
        serialWidth:
          /^\d+$/.test(serialWidth ?? "") && Number(serialWidth) > 0 && Number(serialWidth) <= 250
            ? Number(serialWidth)
            : effective.width,
        [field]: Number(draft),
      };
      const info = information(settings);
      const terminal = io.output as NodeJS.WritableStream & { columns?: number; rows?: number };
      return `${value}\n${(terminal.columns ?? 80) < 40 || (terminal.rows ?? 32) < 12 ? info.compactDescription : info.description}`;
    };
    if (step === "start") {
      const start = await enterFrameValue(io, {
        message: "Serial start",
        default: serialStart ?? String(effective.start),
        editableDefault: serialStart !== undefined,
        onChange: (value) => {
          serialStart = value;
        },
        transformer: (value) => serialFeedback("serialStart", value, effective.start),
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
      transformer: (value) => serialFeedback("serialWidth", value, effective.width),
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
    return finish({ template, serialStart: Number(serialStart), serialWidth: Number(width) });
  }
}
