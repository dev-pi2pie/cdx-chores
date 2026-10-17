import { fileURLToPath, pathToFileURL } from "node:url";

export function runtimeModuleUrl(esmUrl: string | undefined, commonJsFilename?: string): string {
  if (commonJsFilename) return pathToFileURL(commonJsFilename).href;
  if (!esmUrl) throw new Error("docx_startup_error");
  return esmUrl;
}

/** Both private module formats keep fixed runtime assets beside their entry. */
export function runtimeAsset(
  name: "docx-child" | "docx-worker" | "docx-parser",
  moduleUrl: string,
): URL {
  const extension = moduleUrl.endsWith(".cjs") ? ".cjs" : ".mjs";
  return new URL(`./${name}${extension}`, moduleUrl);
}

export function runtimeWorkingDirectory(moduleUrl: string): string {
  return fileURLToPath(new URL(".", moduleUrl));
}
