import { extname } from "node:path";

export function defaultOutputPath(inputPath: string, nextExtension: string): string {
  const extension = nextExtension.startsWith(".") ? nextExtension : `.${nextExtension}`;
  const currentExt = extname(inputPath);
  if (currentExt.length === 0) {
    return `${inputPath}${extension}`;
  }
  return `${inputPath.slice(0, -currentExt.length)}${extension}`;
}

