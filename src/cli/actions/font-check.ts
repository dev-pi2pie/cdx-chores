import { readFile } from "node:fs/promises";
import { TextDecoder } from "node:util";

import {
  defaultFontDiscoveryRunner,
  discoverSystemFonts,
  NERD_FONT_SAMPLE_TEXT,
  type DiscoverFontsResult,
  type FontDiscoveryAttempt,
  type FontDiscoveryCommandRunner,
  type FontDiscoveryMode,
  type FontFace,
} from "../../fonts";
import {
  fontconfigCoverageProvider,
  formatFontCodepoint,
  requiredFontCoverageCodepoints,
} from "../../fonts/coverage";
import { selectFontFaceForCheck, type FontCheckFaceSelectionReason } from "../../fonts/matching";
import type { FontCoverageInconclusiveReason, FontCoverageProviderResult } from "../../fonts/types";
import { getCliColors } from "../colors";
import { CliError } from "../errors";
import { resolveFromCwd } from "../path-utils";
import type { CliRuntime } from "../types";
import { fontDiscoveryInfo, printFontDebugAttempts } from "./font-common";
import { printLine } from "./shared";

type FontCheckRequirement = "nerd";
type FontCheckResultStatus = "pass" | "fail" | "inconclusive";
type FontCheckInconclusiveReason = FontCoverageInconclusiveReason | FontCheckFaceSelectionReason;

export interface FontCheckOptions {
  json?: boolean;
  family?: string;
  text?: string;
  textFile?: string;
  require?: string;
  debug?: boolean;
  discovery?: FontDiscoveryMode;
  runner?: FontDiscoveryCommandRunner;
}

export interface FontCheckActionResult {
  result: FontCheckResultStatus;
  exitCode: number;
  reason?: FontCheckInconclusiveReason;
}

interface ResolvedFontCheckText {
  requirements: FontCheckRequirement[];
  coverageText: string;
  checkedCodepoints: string[];
}

interface FontCheckOutput {
  command: "font check";
  family: string;
  discovery: FontDiscoveryMode;
  adapter: string;
  requirements: FontCheckRequirement[];
  result: FontCheckResultStatus;
  exitCode: number;
  checkedFace: string | null;
  path: string | null;
  reason: FontCheckInconclusiveReason | null;
  checkedCodepoints: string[];
  missingCodepoints: string[];
  warnings: string[];
  info: string[];
  debug?: {
    attempts: FontDiscoveryAttempt[];
  };
}

function usageError(message: string, code = "INVALID_INPUT"): CliError {
  return new CliError(message, { code, exitCode: 2 });
}

function decodeUtf8File(path: string, buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw usageError(`Invalid UTF-8 in --text-file: ${path}.`);
  }
}

async function readRawUtf8TextFile(runtime: CliRuntime, path: string): Promise<string> {
  const resolvedPath = resolveFromCwd(runtime, path);
  let buffer: Buffer;
  try {
    buffer = await readFile(resolvedPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw usageError(`Failed to read --text-file: ${path} (${message})`, "FILE_READ_ERROR");
  }

  const text = decodeUtf8File(path, buffer);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function resolveRequirements(value: string | undefined): FontCheckRequirement[] {
  if (value === undefined) {
    return [];
  }
  if (value !== "nerd") {
    throw usageError("--require must be one of: nerd.");
  }
  return ["nerd"];
}

async function resolveFontCheckText(
  runtime: CliRuntime,
  options: FontCheckOptions,
): Promise<ResolvedFontCheckText> {
  const hasInlineText = options.text !== undefined;
  const hasTextFile = options.textFile !== undefined;
  if (hasInlineText === hasTextFile) {
    throw usageError("font check requires exactly one of --text or --text-file.");
  }

  const requirements = resolveRequirements(options.require);
  const text = hasInlineText
    ? (options.text as string)
    : await readRawUtf8TextFile(runtime, options.textFile as string);
  const coverageText = requirements.includes("nerd") ? `${text}\n${NERD_FONT_SAMPLE_TEXT}` : text;
  const checkedCodepoints = requiredFontCoverageCodepoints(coverageText).map(formatFontCodepoint);
  return {
    requirements,
    coverageText,
    checkedCodepoints,
  };
}

function fontCheckExitCode(result: FontCheckResultStatus): number {
  if (result === "pass") {
    return 0;
  }
  if (result === "fail") {
    return 1;
  }
  return 3;
}

function resultFromCoverage(providerResult: FontCoverageProviderResult): {
  result: FontCheckResultStatus;
  exitCode: number;
  reason: FontCheckInconclusiveReason | null;
  checkedCodepoints: string[];
  missingCodepoints: string[];
  path: string | null;
} {
  if (providerResult.status === "inconclusive") {
    return {
      result: "inconclusive",
      exitCode: fontCheckExitCode("inconclusive"),
      reason: providerResult.reason,
      checkedCodepoints: providerResult.checkedCodepoints,
      missingCodepoints: providerResult.missingCodepoints,
      path: providerResult.path ?? null,
    };
  }

  const result = providerResult.supportsText ? "pass" : "fail";
  return {
    result,
    exitCode: fontCheckExitCode(result),
    reason: null,
    checkedCodepoints: providerResult.checkedCodepoints,
    missingCodepoints: providerResult.missingCodepoints,
    path: providerResult.path,
  };
}

const INCONCLUSIVE_REASON_MESSAGES: Record<FontCheckInconclusiveReason, string> = {
  "no-matching-family": "no discovered font face matched the requested family.",
  "ambiguous-family":
    "family query matched multiple discovered families. Use an exact family name.",
  "no-inspectable-font-file": "matched font has no inspectable font file path.",
  "fontconfig-unavailable": "fontconfig fc-query is unavailable.",
  "fontconfig-query-failed": "fontconfig fc-query could not inspect the selected font file.",
  "fontconfig-charset-unavailable": "fontconfig did not return usable charset coverage.",
  "unsupported-font-format": "matched font file format is not supported for coverage checks yet.",
  "unsupported-ttc-collection":
    "matched font is a TTC collection, but this build cannot inspect individual collection faces yet.",
  "empty-required-codepoints": "the text source did not contain required printable codepoints.",
};

function checkedFaceName(face: FontFace | undefined): string | null {
  return face?.fullName ?? null;
}

function printDiscoveryWarnings(runtime: CliRuntime, warnings: string[]): void {
  for (const warning of warnings) {
    printLine(runtime.stderr, `Warning: ${warning}`);
  }
}

function printFontCheckTextOutput(runtime: CliRuntime, output: FontCheckOutput): void {
  const pc = getCliColors(runtime);
  printLine(runtime.stdout, pc.bold(pc.cyan("cdx-chores font check")));
  printLine(runtime.stdout, `${pc.dim("Family:")} ${output.family}`);
  printLine(runtime.stdout, `${pc.dim("Discovery:")} ${output.discovery}`);
  printLine(runtime.stdout, `${pc.dim("Adapter:")} ${output.adapter}`);
  printLine(runtime.stdout, `${pc.dim("Checked face:")} ${output.checkedFace ?? "(none)"}`);
  if (output.path) {
    printLine(runtime.stdout, `${pc.dim("Path:")} ${output.path}`);
  }
  if (output.requirements.length > 0) {
    printLine(runtime.stdout, `${pc.dim("Requirement:")} ${output.requirements.join(", ")}`);
  }
  for (const message of output.info) {
    printLine(runtime.stdout, `${pc.dim("Info:")} ${message}`);
  }

  printLine(runtime.stdout, "");
  printLine(runtime.stdout, `${pc.dim("Result:")} ${output.result}`);
  if (output.reason) {
    printLine(
      runtime.stdout,
      `${pc.dim("Reason:")} ${INCONCLUSIVE_REASON_MESSAGES[output.reason]}`,
    );
  }
  if (output.missingCodepoints.length > 0) {
    printLine(runtime.stdout, "Missing codepoints:");
    for (const codepoint of output.missingCodepoints) {
      printLine(runtime.stdout, `- ${codepoint}`);
    }
  }
}

function printFontCheckJsonOutput(runtime: CliRuntime, output: FontCheckOutput): void {
  printLine(runtime.stdout, JSON.stringify(output, null, 2));
}

function createOutput(input: {
  family: string;
  discovery: DiscoverFontsResult;
  requirements: FontCheckRequirement[];
  result: FontCheckResultStatus;
  exitCode: number;
  face?: FontFace;
  path: string | null;
  reason: FontCheckInconclusiveReason | null;
  checkedCodepoints: string[];
  missingCodepoints: string[];
  info: string[];
  debug?: boolean;
}): FontCheckOutput {
  return {
    command: "font check",
    family: input.family,
    discovery: input.discovery.discovery,
    adapter: input.discovery.adapter,
    requirements: input.requirements,
    result: input.result,
    exitCode: input.exitCode,
    checkedFace: checkedFaceName(input.face),
    path: input.path,
    reason: input.reason,
    checkedCodepoints: input.checkedCodepoints,
    missingCodepoints: input.missingCodepoints,
    warnings: input.discovery.warnings,
    info: input.info,
    ...(input.debug && input.discovery.attempts
      ? { debug: { attempts: input.discovery.attempts } }
      : {}),
  };
}

export async function actionFontCheck(
  runtime: CliRuntime,
  options: FontCheckOptions = {},
): Promise<FontCheckActionResult> {
  const family = options.family?.trim();
  if (!family) {
    throw usageError("--family is required for font check.");
  }

  const text = await resolveFontCheckText(runtime, options);
  const discovery = await discoverSystemFonts({
    platform: runtime.platform,
    discovery: options.discovery,
    includeAttempts: options.debug,
    runner: options.runner,
  });
  const info = fontDiscoveryInfo(discovery);
  const selection = selectFontFaceForCheck(discovery.faces, family);

  let output: FontCheckOutput;
  if (selection.status === "inconclusive") {
    const result = "inconclusive";
    output = createOutput({
      family,
      discovery,
      requirements: text.requirements,
      result,
      exitCode: fontCheckExitCode(result),
      path: null,
      reason: selection.reason,
      checkedCodepoints: text.checkedCodepoints,
      missingCodepoints: [],
      info,
      debug: options.debug,
    });
  } else {
    const providerResult = await fontconfigCoverageProvider.check({
      face: selection.face,
      text: text.coverageText,
      runner: options.runner ?? defaultFontDiscoveryRunner,
    });
    const mapped = resultFromCoverage(providerResult);
    output = createOutput({
      family,
      discovery,
      requirements: text.requirements,
      result: mapped.result,
      exitCode: mapped.exitCode,
      face: selection.face,
      path: mapped.path,
      reason: mapped.reason,
      checkedCodepoints: mapped.checkedCodepoints,
      missingCodepoints: mapped.missingCodepoints,
      info,
      debug: options.debug,
    });
  }

  if (options.json) {
    printFontCheckJsonOutput(runtime, output);
  } else {
    printFontCheckTextOutput(runtime, output);
    if (options.debug) {
      printFontDebugAttempts(runtime, discovery);
    }
    printDiscoveryWarnings(runtime, discovery.warnings);
  }

  return {
    result: output.result,
    exitCode: output.exitCode,
    ...(output.reason ? { reason: output.reason } : {}),
  };
}
