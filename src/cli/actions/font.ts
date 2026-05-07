import { discoverSystemFonts, type FontDiscoveryCommandRunner, type FontFace } from "../../fonts";
import { getCliColors } from "../colors";
import { CliError } from "../errors";
import type { CliRuntime } from "../types";
import { printLine } from "./shared";

export interface FontListOptions {
  json?: boolean;
  family?: string;
  limit?: number;
  runner?: FontDiscoveryCommandRunner;
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
  if (!family) {
    return true;
  }
  const needle = family.trim().toLowerCase();
  return face.family.toLowerCase().includes(needle) || face.fullName.toLowerCase().includes(needle);
}

function formatFontFace(face: FontFace): string {
  const label = face.fullName && face.fullName !== face.family ? face.fullName : face.family;
  const details = [
    face.style,
    face.weight ? `weight ${face.weight}` : "",
    face.format && face.format !== "unknown" ? face.format : "",
  ].filter(Boolean);
  return details.length > 0 ? `${label} (${details.join(", ")})` : label;
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

export async function actionFontList(
  runtime: CliRuntime,
  options: FontListOptions = {},
): Promise<void> {
  const limit = normalizeLimit(options.limit);
  const discovery = await discoverSystemFonts({
    platform: runtime.platform,
    runner: options.runner,
  });
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
          warnings: discovery.warnings,
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
  printLine(runtime.stdout, `${pc.dim("Adapter:")} ${discovery.adapter}`);
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
