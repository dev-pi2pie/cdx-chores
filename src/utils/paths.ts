import path, { extname } from "node:path";

export function isContainedRelativePath(
  relativePath: string,
  { allowEqual = false, pathApi = path }: { allowEqual?: boolean; pathApi?: typeof path } = {},
): boolean {
  if (pathApi.parse(relativePath).root) return false;
  const normalized = pathApi.normalize(relativePath);
  if (normalized === "." || normalized === `.${pathApi.sep}`) return allowEqual;
  return normalized !== ".." && !normalized.startsWith(`..${pathApi.sep}`);
}

export function isUnrootedFilePath(value: string, pathApi: typeof path = path): boolean {
  if (pathApi.parse(value).root || value.includes("\0")) return false;
  if (pathApi.sep !== "\\") return true;
  return value
    .split(/[\\/]/)
    .every((segment) => segment === "." || segment === ".." || !/:|[. ]$/.test(segment));
}

export function defaultOutputPath(inputPath: string, nextExtension: string): string {
  const extension = nextExtension.startsWith(".") ? nextExtension : `.${nextExtension}`;
  const currentExt = extname(inputPath);
  if (currentExt.length === 0) {
    return `${inputPath}${extension}`;
  }
  return `${inputPath.slice(0, -currentExt.length)}${extension}`;
}
