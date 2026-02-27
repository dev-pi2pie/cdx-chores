import { extname } from "node:path";

export type RenameInteractiveCodexScope = "auto" | "images" | "docs";

export interface RenameInteractiveCodexFlags {
  codexImages: boolean;
  codexDocs: boolean;
}

export interface RenameCliCodexOptions {
  codex?: boolean;
  codexImages?: boolean;
  codexDocs?: boolean;
}

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".avif",
]);

const SUPPORTED_DOC_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".html",
  ".htm",
  ".pdf",
  ".docx",
]);

export function resolveAutoCodexFlagsForBatchProfile(profile: string): RenameInteractiveCodexFlags {
  switch (profile) {
    case "images":
      return { codexImages: true, codexDocs: false };
    case "media":
      return { codexImages: true, codexDocs: false };
    case "docs":
      return { codexImages: false, codexDocs: true };
    default:
      return { codexImages: true, codexDocs: true };
  }
}

export function resolveAutoCodexFlagsForFilePath(path: string): RenameInteractiveCodexFlags {
  const ext = extname(path).toLowerCase();
  return {
    codexImages: SUPPORTED_IMAGE_EXTENSIONS.has(ext),
    codexDocs: SUPPORTED_DOC_EXTENSIONS.has(ext),
  };
}

export function resolveAutoCodexFlagsForPaths(paths: string[]): RenameInteractiveCodexFlags {
  let codexImages = false;
  let codexDocs = false;

  for (const path of paths) {
    const flags = resolveAutoCodexFlagsForFilePath(path);
    codexImages = codexImages || flags.codexImages;
    codexDocs = codexDocs || flags.codexDocs;
    if (codexImages && codexDocs) {
      break;
    }
  }

  return { codexImages, codexDocs };
}

export function resolveCodexFlagsFromScope(options: {
  scope: RenameInteractiveCodexScope;
  fallbackAuto: RenameInteractiveCodexFlags;
}): RenameInteractiveCodexFlags {
  switch (options.scope) {
    case "images":
      return { codexImages: true, codexDocs: false };
    case "docs":
      return { codexImages: false, codexDocs: true };
    case "auto":
    default:
      return options.fallbackAuto;
  }
}

export function resolveCodexFlagsFromCliOptions(options: {
  cli: RenameCliCodexOptions;
  fallbackAuto: RenameInteractiveCodexFlags;
}): RenameInteractiveCodexFlags {
  const explicitImages = options.cli.codexImages ?? false;
  const explicitDocs = options.cli.codexDocs ?? false;
  const hasExplicitFlags = explicitImages || explicitDocs;

  if (hasExplicitFlags) {
    return {
      codexImages: explicitImages,
      codexDocs: explicitDocs,
    };
  }

  if (options.cli.codex ?? false) {
    return options.fallbackAuto;
  }

  return {
    codexImages: false,
    codexDocs: false,
  };
}
