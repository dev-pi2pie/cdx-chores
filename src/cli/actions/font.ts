import {
  discoverSystemFonts,
  type DiscoverFontsResult,
  type FontDiscoveryCommandRunner,
  type FontDiscoveryMode,
  type FontFace,
} from "../../fonts";
import { getCliColors } from "../colors";
import { CliError } from "../errors";
import type { CliRuntime } from "../types";
import { printLine } from "./shared";

export interface FontListOptions {
  json?: boolean;
  family?: string;
  limit?: number;
  debug?: boolean;
  discovery?: FontDiscoveryMode;
  runner?: FontDiscoveryCommandRunner;
}

export interface FontInspectOptions {
  json?: boolean;
  family?: string;
  debug?: boolean;
  discovery?: FontDiscoveryMode;
  runner?: FontDiscoveryCommandRunner;
}

interface MatchedFontFace {
  face: FontFace;
  matchRank: number;
}

interface FontInspectFaceOutput {
  family: string;
  fullName: string;
  style: FontFace["style"];
  weight?: number;
  source: FontFace["source"];
  format?: Exclude<FontFace["format"], "unknown">;
  path?: string;
}

function normalizeLimit(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new CliError("--limit must be a positive integer.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return value;
}

function normalizeFontQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function fontFamilyMatchRank(face: FontFace, family: string | undefined): number | undefined {
  if (!family) {
    return 0;
  }
  const needle = normalizeFontQuery(family);
  const faceFamily = normalizeFontQuery(face.family);
  const fullName = normalizeFontQuery(face.fullName);

  if (faceFamily === needle) {
    return 0;
  }
  if (fullName === needle) {
    return 1;
  }
  if (faceFamily.includes(needle)) {
    return 2;
  }
  if (fullName.includes(needle)) {
    return 3;
  }
  return undefined;
}

function matchesFamily(face: FontFace, family: string | undefined): boolean {
  return fontFamilyMatchRank(face, family) !== undefined;
}

function fontFaceLabel(face: FontFace): string {
  return face.fullName && face.fullName !== face.family ? face.fullName : face.family;
}

function fontFaceSummaryDetails(face: FontFace): string[] {
  return [
    face.style,
    face.weight ? `weight ${face.weight}` : "",
    face.format && face.format !== "unknown" ? face.format : "",
  ].filter(Boolean);
}

function fontFaceDetailEntries(face: FontFace): Array<[string, string]> {
  const entries: Array<[string, string]> = [["style", face.style]];
  if (face.weight !== undefined) {
    entries.push(["weight", String(face.weight)]);
  }
  entries.push(["source", face.source]);
  if (face.format !== undefined && face.format !== "unknown") {
    entries.push(["format", face.format]);
  }
  if (face.path) {
    entries.push(["path", face.path]);
  }
  return entries;
}

function formatFontFace(face: FontFace): string {
  const details = fontFaceSummaryDetails(face);
  return details.length > 0
    ? `${fontFaceLabel(face)} (${details.join(", ")})`
    : fontFaceLabel(face);
}

function uniqueFontFaces(faces: FontFace[]): FontFace[] {
  const seen = new Set<string>();
  return faces.filter((face) => {
    const key = [
      face.family,
      face.fullName,
      face.style,
      face.weight ?? "",
      face.path ?? "",
      face.format ?? "",
    ]
      .join("\0")
      .toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function sortFontFaces(left: FontFace, right: FontFace): number {
  return (
    left.family.localeCompare(right.family) ||
    left.fullName.localeCompare(right.fullName) ||
    left.style.localeCompare(right.style) ||
    (left.weight ?? Number.MAX_SAFE_INTEGER) - (right.weight ?? Number.MAX_SAFE_INTEGER) ||
    (left.path ?? "").localeCompare(right.path ?? "")
  );
}

function inspectFontFaces(faces: FontFace[], family: string): FontFace[] {
  const matched = uniqueFontFaces(faces).flatMap((face): MatchedFontFace[] => {
    const matchRank = fontFamilyMatchRank(face, family);
    return matchRank === undefined ? [] : [{ face, matchRank }];
  });

  return matched
    .sort((left, right) => left.matchRank - right.matchRank || sortFontFaces(left.face, right.face))
    .map((match) => match.face);
}

function serializeInspectFace(face: FontFace): FontInspectFaceOutput {
  return {
    family: face.family,
    fullName: face.fullName,
    style: face.style,
    ...(face.weight !== undefined ? { weight: face.weight } : {}),
    source: face.source,
    ...(face.format !== undefined && face.format !== "unknown" ? { format: face.format } : {}),
    ...(face.path ? { path: face.path } : {}),
  };
}

function printDebugAttempts(runtime: CliRuntime, discovery: DiscoverFontsResult): void {
  if (!discovery.attempts) {
    return;
  }

  const pc = getCliColors(runtime);
  printLine(runtime.stdout, "");
  printLine(runtime.stdout, pc.bold("Debug:"));
  for (const attempt of discovery.attempts) {
    const status = attempt.status === "success" ? "success" : "failed";
    printLine(
      runtime.stdout,
      `- ${attempt.adapter}: ${status} in ${attempt.durationMs}ms (${attempt.message})`,
    );
  }
}

function fontDiscoveryInfo(discovery: DiscoverFontsResult): string[] {
  if (discovery.selectionReason === "macos-auto-fontconfig") {
    return [
      "using fontconfig because fc-list is available. Use --discovery native to force macOS system_profiler.",
    ];
  }
  if (discovery.selectionReason === "macos-auto-native-fallback") {
    return ["fontconfig was unavailable, so macOS native discovery was used."];
  }
  return [];
}

export async function actionFontList(
  runtime: CliRuntime,
  options: FontListOptions = {},
): Promise<void> {
  const limit = normalizeLimit(options.limit);
  const discovery = await discoverSystemFonts({
    platform: runtime.platform,
    discovery: options.discovery,
    includeAttempts: options.debug,
    runner: options.runner,
  });
  const info = fontDiscoveryInfo(discovery);
  const familyFilter = options.family?.trim();
  const faces = uniqueFontFaces(discovery.faces)
    .filter((face) => matchesFamily(face, familyFilter))
    .slice(0, limit);

  if (options.json) {
    printLine(
      runtime.stdout,
      JSON.stringify(
        {
          adapter: discovery.adapter,
          discovery: discovery.discovery,
          warnings: discovery.warnings,
          ...(options.debug && discovery.attempts
            ? { debug: { attempts: discovery.attempts } }
            : {}),
          count: faces.length,
          fonts: faces,
        },
        null,
        2,
      ),
    );
    return;
  }

  const pc = getCliColors(runtime);
  printLine(runtime.stdout, pc.bold(pc.cyan("cdx-chores font list")));
  printLine(runtime.stdout, `${pc.dim("Discovery:")} ${discovery.discovery}`);
  printLine(runtime.stdout, `${pc.dim("Adapter:")} ${discovery.adapter}`);
  for (const message of info) {
    printLine(runtime.stdout, `${pc.dim("Info:")} ${message}`);
  }
  if (options.debug) {
    printDebugAttempts(runtime, discovery);
  }
  if (discovery.warnings.length > 0) {
    for (const warning of discovery.warnings) {
      printLine(runtime.stderr, `Warning: ${warning}`);
    }
  }
  if (faces.length === 0) {
    printLine(runtime.stdout, "No fonts matched.");
    return;
  }

  for (const face of faces) {
    printLine(runtime.stdout, `- ${formatFontFace(face)}`);
    if (face.path) {
      printLine(runtime.stdout, `  ${pc.dim(face.path)}`);
    }
  }
}

function groupFacesByFamily(faces: FontFace[]): Array<{ family: string; faces: FontFace[] }> {
  const groups = new Map<string, FontFace[]>();
  for (const face of faces) {
    const group = groups.get(face.family);
    if (group) {
      group.push(face);
    } else {
      groups.set(face.family, [face]);
    }
  }
  return Array.from(groups, ([family, groupFaces]) => ({ family, faces: groupFaces }));
}

function printInspectFace(runtime: CliRuntime, face: FontFace): void {
  const pc = getCliColors(runtime);
  printLine(runtime.stdout, `- ${face.fullName}`);
  for (const [label, value] of fontFaceDetailEntries(face)) {
    printLine(runtime.stdout, `  ${pc.dim(`${label}:`)} ${value}`);
  }
}

export async function actionFontInspect(
  runtime: CliRuntime,
  options: FontInspectOptions = {},
): Promise<void> {
  const family = options.family?.trim();
  if (!family) {
    throw new CliError("--family is required for font inspect.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const discovery = await discoverSystemFonts({
    platform: runtime.platform,
    discovery: options.discovery,
    includeAttempts: options.debug,
    runner: options.runner,
  });
  const info = fontDiscoveryInfo(discovery);
  const matches = inspectFontFaces(discovery.faces, family);

  if (options.json) {
    printLine(
      runtime.stdout,
      JSON.stringify(
        {
          command: "font inspect",
          family,
          discovery: discovery.discovery,
          adapter: discovery.adapter,
          warnings: discovery.warnings,
          info,
          ...(options.debug && discovery.attempts
            ? { debug: { attempts: discovery.attempts } }
            : {}),
          matches: matches.map(serializeInspectFace),
        },
        null,
        2,
      ),
    );
    return;
  }

  const pc = getCliColors(runtime);
  printLine(runtime.stdout, pc.bold(pc.cyan("cdx-chores font inspect")));
  printLine(runtime.stdout, `${pc.dim("Family:")} ${family}`);
  printLine(runtime.stdout, `${pc.dim("Discovery:")} ${discovery.discovery}`);
  printLine(runtime.stdout, `${pc.dim("Adapter:")} ${discovery.adapter}`);
  for (const message of info) {
    printLine(runtime.stdout, `${pc.dim("Info:")} ${message}`);
  }
  if (options.debug) {
    printDebugAttempts(runtime, discovery);
  }
  if (discovery.warnings.length > 0) {
    for (const warning of discovery.warnings) {
      printLine(runtime.stderr, `Warning: ${warning}`);
    }
  }

  printLine(runtime.stdout, "");
  if (matches.length === 0) {
    printLine(runtime.stdout, "Faces: 0");
    printLine(runtime.stdout, "Coverage: not checked.");
    return;
  }

  printLine(runtime.stdout, pc.bold("Faces:"));
  for (const group of groupFacesByFamily(matches)) {
    if (group.family !== family) {
      printLine(runtime.stdout, `${pc.dim("Family group:")} ${group.family}`);
    }
    for (const face of group.faces) {
      printInspectFace(runtime, face);
    }
  }
  printLine(runtime.stdout, "");
  printLine(runtime.stdout, "Coverage: not checked.");
}
