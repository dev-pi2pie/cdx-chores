import { realpath, stat } from "node:fs/promises";
import { CliError } from "../errors";
export interface SourceSnapshot {
  canonicalPath: string;
  fingerprint: string;
}
export async function inspectSource(path: string): Promise<SourceSnapshot> {
  const canonicalPath = await realpath(path);
  const file = await stat(canonicalPath, { bigint: true });
  if (!file.isFile())
    throw new CliError("Video source must be a regular file.", { code: "FRAME_SOURCE_INVALID" });
  return Object.freeze({
    canonicalPath,
    fingerprint: JSON.stringify([
      canonicalPath,
      String(file.dev),
      String(file.ino),
      String(file.size),
      String(file.mtimeNs),
      String(file.ctimeNs),
    ]),
  });
}
