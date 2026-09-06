/** Native metadata selects one cache directory, never an arbitrary relative path. */
export function nativeCacheParts(
  version: unknown,
  platform: unknown,
): [string, string, string, string] {
  if (
    typeof version !== "string" ||
    version.match(/^v\d+\.\d+\.\d+$/)?.[0] !== version ||
    typeof platform !== "string" ||
    platform.match(/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/)?.[0] !== platform
  ) {
    throw new Error("Unrecognized native cache layout.");
  }
  return [".duckdb", "extensions", version, platform];
}
