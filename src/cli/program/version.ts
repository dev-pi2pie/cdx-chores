import { readFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import { EMBEDDED_PACKAGE_VERSION } from "./version-embedded";

function* candidateSearchRoots(): Generator<string> {
  yield dirname(fileURLToPath(import.meta.url));

  const argvPath = process.argv[1];
  if (typeof argvPath === "string" && argvPath.length > 0) {
    yield dirname(resolvePath(argvPath));
  }

  yield process.cwd();
}

function* walkUpDirectories(start: string, maxLevels: number): Generator<string> {
  let current = start;
  for (let depth = 0; depth < maxLevels; depth += 1) {
    yield current;
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
}

function resolveVersionFromPath(start: string, maxLevels: number): string | null {
  for (const directory of walkUpDirectories(start, maxLevels)) {
    try {
      const raw = readFileSync(join(directory, "package.json"), "utf8");
      const data = JSON.parse(raw) as { version?: string };
      if (data.version) {
        return data.version;
      }
    } catch {
      // Try parent directories.
    }
  }
  return null;
}

function normalizeVersion(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

type ResolvePackageVersionOptions = {
  embeddedVersion?: string | null;
  candidateRoots?: string[];
  maxLevels?: number;
  resolveFromPath?: (start: string, maxLevels: number) => string | null;
};

export function resolvePackageVersion(options: ResolvePackageVersionOptions = {}): string {
  const embeddedVersion = normalizeVersion(options.embeddedVersion ?? EMBEDDED_PACKAGE_VERSION);
  if (embeddedVersion) {
    return embeddedVersion;
  }

  const maxLevels = options.maxLevels ?? 8;
  const resolveFromPath = options.resolveFromPath ?? resolveVersionFromPath;
  const roots = options.candidateRoots ?? [...candidateSearchRoots()];
  const seen = new Set<string>();
  for (const root of roots) {
    if (seen.has(root)) {
      continue;
    }
    seen.add(root);
    const version = normalizeVersion(resolveFromPath(root, maxLevels));
    if (version) {
      return version;
    }
  }

  return "0.0.0";
}

export function getFormattedVersionLabel(): string {
  const version = resolvePackageVersion();

  return pc.bgBlack(pc.bold(pc.italic(` cdx-chores ${pc.cyanBright(`ver.${version}`)} `)));
}
