import { promptTextWithGhost } from "../../prompts/text-inline";
import { resolvePathPromptRuntimeConfig } from "../../prompts/path-config";
import { chooseFrameOption, enterFrameValue, type FramePromptIO } from "./simple-prompts";

export type FrameNamingMode = "single" | "set" | "sequence";
export type FrameSetPreset = "first-last" | "first-middle-last";
export interface FrameNamingSettings {
  template: string;
  serialStart?: number;
  serialWidth?: number;
}

const defaults: Record<FrameNamingMode, string> = {
  single: "{stem}-frame",
  set: "{stem}-{selection}-frame",
  sequence: "{stem}-{serial}",
};

export function validateFrameTemplate(mode: FrameNamingMode, template: string): true | string {
  if (!template.trim() || /[/\\\p{Cc}]/u.test(template))
    return "Enter a basename template without path components.";
  const tokens = [...template.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]!);
  if (/[{}]/.test(template.replace(/\{[^{}]+\}/g, ""))) return "Malformed placeholder.";
  let serials = 0;
  for (const token of tokens) {
    if (token === "stem" || token === "frame") continue;
    if (token === "selection" && mode !== "sequence") continue;
    if (mode === "sequence" && /^serial(?:_|$)/.test(token)) {
      try {
        parseSerialToken(token);
        serials++;
        continue;
      } catch (error) {
        return (error as Error).message;
      }
    }
    return `Placeholder {${token}} is unavailable for ${mode} naming.`;
  }
  if (mode === "set" && !tokens.includes("selection"))
    return "Frame-set templates require {selection}.";
  if (mode === "sequence" && serials !== 1)
    return "Sequence templates require exactly one {serial...} placeholder.";
  return true;
}

function parseSerialToken(token: string): { start?: number; width?: number } {
  const parts = token.split("_").slice(1);
  let start: number | undefined;
  let width: number | undefined;
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]!;
    if (/^#+$/.test(part) && width === undefined) width = part.length;
    else if (part === "start" && start === undefined && /^\d+$/.test(parts[index + 1] ?? ""))
      start = Number(parts[++index]);
    else throw new Error("Invalid or duplicate serial parameter.");
  }
  if ((start !== undefined && !Number.isSafeInteger(start)) || (width !== undefined && width > 250))
    throw new Error("Serial parameter exceeds filename limits.");
  return { start, width };
}

export function effectiveFrameSerial(settings: FrameNamingSettings): {
  start: number;
  width: number;
} {
  const serial = /\{(serial(?:_[^{}]*)?)\}/.exec(settings.template);
  const embedded = serial ? parseSerialToken(serial[1]!) : {};
  return {
    start: settings.serialStart ?? embedded.start ?? 1,
    width: settings.serialWidth ?? embedded.width ?? 6,
  };
}

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
): Promise<FrameNamingSettings | null> {
  const choice = await chooseFrameOption(
    io,
    "Image naming",
    [
      { name: `Default: ${defaults[mode]}`, value: "default" },
      { name: "Custom template", value: "custom" },
      { name: "Back", value: "back" },
    ],
    "back",
  );
  if (choice === "back") return null;
  let template = defaults[mode];
  if (choice === "custom") {
    template = await promptTextWithGhost({
      message: "Filename template",
      ghostText: defaults[mode],
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
      runtimeConfig: {
        ...resolvePathPromptRuntimeConfig(),
        ...(io.simple ? { mode: "simple" as const } : {}),
      },
      validate: (value) => validateFrameTemplate(mode, value),
      promptImpls: {
        simpleInput: async (config) => {
          const value = await enterFrameValue(io, {
            message: config.message,
            default: template,
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
  }
  const settings: FrameNamingSettings = { template };
  if (mode === "sequence") {
    const effective = effectiveFrameSerial(settings);
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
