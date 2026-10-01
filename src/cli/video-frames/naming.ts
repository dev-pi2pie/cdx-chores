import { basename, extname } from "node:path";
import { normalizeRenderedBaseName, slugifyName } from "../../utils/slug";
import { CliError } from "../errors";
import { formatSerialValue } from "../rename/planner/serial";
import { assertImageBasename } from "./publication";
import type { ImageFormat } from "./image-options";
export type FrameNamingMode = "single" | "set" | "sequence";
export interface FrameNamingSettings {
  template: string;
  serialStart?: number;
  serialWidth?: number;
}
export const FRAME_NAME_DEFAULTS: Record<FrameNamingMode, string> = {
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
  let start: number | undefined, width: number | undefined;
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
export function effectiveFrameSerial(settings: FrameNamingSettings) {
  const serial = /\{(serial(?:_[^{}]*)?)\}/.exec(settings.template);
  const embedded = serial ? parseSerialToken(serial[1]!) : {};
  const start = settings.serialStart ?? embedded.start ?? 1;
  const width = settings.serialWidth ?? embedded.width ?? 6;
  if (
    !Number.isSafeInteger(start) ||
    start < 0 ||
    !Number.isSafeInteger(width) ||
    width < 1 ||
    width > 250
  )
    throw new CliError("Serial start/width must be safe integers within filename limits.", {
      code: "FRAME_SERIAL_INVALID",
    });
  return { start, width };
}
export function sourceStem(source: string): string {
  return slugifyName(basename(source, extname(source))).slice(0, 48);
}
export class FrameNamer {
  readonly stem: string;
  readonly settings: FrameNamingSettings;
  readonly serial: { start: number; width: number };
  constructor(
    readonly mode: FrameNamingMode,
    source: string,
    settings?: FrameNamingSettings,
  ) {
    this.stem = sourceStem(source);
    this.settings = Object.freeze({ template: FRAME_NAME_DEFAULTS[mode], ...settings });
    const valid = validateFrameTemplate(mode, this.settings.template);
    if (valid !== true) throw new CliError(valid, { code: "FRAME_TEMPLATE_INVALID" });
    if (
      mode !== "sequence" &&
      (settings?.serialStart !== undefined || settings?.serialWidth !== undefined)
    )
      throw new CliError("Serial settings are available only for sequences.", {
        code: "FRAME_NAMING_SCOPE",
      });
    this.serial = effectiveFrameSerial(this.settings);
  }
  name(input: {
    frameNumber: number;
    format: ImageFormat;
    selection?: "first" | "middle" | "last" | "custom";
    index?: number;
  }): string {
    if (!Number.isSafeInteger(input.frameNumber) || input.frameNumber < 1)
      throw new CliError("Filename requires a verified source frame number.", {
        code: "FRAME_NUMBER_INVALID",
      });
    let serial = "";
    if (this.mode === "sequence") {
      if (
        !Number.isSafeInteger(input.index) ||
        input.index! < 0 ||
        input.index! > Number.MAX_SAFE_INTEGER - this.serial.start
      )
        throw new CliError("Sequence serial exceeds the safe integer limit.", {
          code: "FRAME_NUMERIC_LIMIT",
        });
      serial = formatSerialValue(this.serial.start + input.index!, this.serial.width);
    } else if (
      !input.selection ||
      (this.mode === "set" && input.selection === "custom") ||
      (this.mode === "single" && input.selection === "middle")
    )
      throw new CliError("Filename requires its requested selection label.", {
        code: "FRAME_SELECTION_REQUIRED",
      });
    const rendered = this.settings.template.replace(/\{([^{}]+)\}/g, (_, token: string) =>
      token === "stem"
        ? this.stem
        : token === "frame"
          ? String(input.frameNumber)
          : token === "selection"
            ? input.selection!
            : serial,
    );
    const name = `${normalizeRenderedBaseName(rendered)}.${input.format}`;
    assertImageBasename(name);
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))
      throw new CliError("Generated image filename is a reserved device name.", {
        code: "FRAME_NAME_INVALID",
      });
    return name;
  }
}
