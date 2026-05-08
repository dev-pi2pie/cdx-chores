import {
  discoverSystemFonts,
  type FontDiscoveryCommandRunner,
  type FontDiscoveryMode,
  type FontFace,
} from "../../fonts";
import { inspectFontFaces, matchesFontFamily, uniqueFontFaces } from "../../fonts/matching";
import { getCliColors } from "../colors";
import { CliError } from "../errors";
import type { CliRuntime } from "../types";
import { fontDiscoveryInfo, printFontDebugAttempts } from "./font-common";
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

interface FontInspectFaceOutput {
  family: string;
  fullName: string;
  style: FontFace["style"];
  weight?: number;
  source: FontFace["source"];
  format?: Exclude<FontFace["format"], "unknown">;
  faceIndex?: number;
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

function matchesFamily(face: FontFace, family: string | undefined): boolean {
  return matchesFontFamily(face, family);
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
  if (face.faceIndex !== undefined) {
    entries.push(["face index", String(face.faceIndex)]);
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

function serializeInspectFace(face: FontFace): FontInspectFaceOutput {
  return {
    family: face.family,
    fullName: face.fullName,
    style: face.style,
    ...(face.weight !== undefined ? { weight: face.weight } : {}),
    source: face.source,
    ...(face.format !== undefined && face.format !== "unknown" ? { format: face.format } : {}),
    ...(face.faceIndex !== undefined ? { faceIndex: face.faceIndex } : {}),
    ...(face.path ? { path: face.path } : {}),
  };
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
    printFontDebugAttempts(runtime, discovery);
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
    printFontDebugAttempts(runtime, discovery);
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
