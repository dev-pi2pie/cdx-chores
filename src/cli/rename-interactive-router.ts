import { extname } from "node:path";

export type RenameInteractiveCodexScope = "auto" | "images" | "docs";

export interface RenameInteractiveCodexFlags {
  codexImages: boolean;
  codexDocs: boolean;
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
