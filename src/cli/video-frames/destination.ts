import { dirname, join, resolve } from "node:path";
import { lstat, opendir, stat } from "node:fs/promises";
import { CliError } from "../errors";
import { assertImageBasename } from "./publication";
import { sourceStem, type FrameNamingMode } from "./naming";
import { requireImageExtension, type ImageFormat } from "./image-options";
export async function frameDestination(input: {
  mode: FrameNamingMode;
  source: string;
  format: ImageFormat;
  output?: string;
  singleName?: string;
  cwd?: string;
}) {
  const cwd = input.cwd ?? process.cwd(),
    source = resolve(cwd, input.source);
  const stem = sourceStem(source),
    kind = input.mode === "single" ? "file" : "folder";
  const fallback =
    kind === "file" ? (input.singleName ?? `${stem}-frame.${input.format}`) : `${stem}-frames`;
  if (kind === "file" && input.output === undefined) assertImageBasename(fallback);
  if (input.output !== undefined && !input.output.trim())
    throw new CliError("Output path cannot be empty.", { code: "FRAME_TARGET_INVALID" });
  const path =
    input.output === undefined ? join(dirname(source), fallback) : resolve(cwd, input.output);
  if (kind === "file") {
    requireImageExtension(path, input.format);
    if (path === source)
      throw new CliError("Image target aliases the video source.", { code: "FRAME_SOURCE_ALIAS" });
  }
  let nonempty = false;
  const entry = await lstat(path, { bigint: true }).catch((error) => {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return undefined;
    throw error;
  });
  if (entry) {
    if (entry.isSymbolicLink() || (kind === "file" ? !entry.isFile() : !entry.isDirectory()))
      throw new CliError(`Image destination must be an ordinary ${kind}.`, {
        code: "FRAME_TARGET_KIND",
      });
    if (kind === "file") {
      const original = await stat(source, { bigint: true });
      if (entry.dev === original.dev && entry.ino === original.ino)
        throw new CliError("Image target aliases the video source.", {
          code: "FRAME_SOURCE_ALIAS",
        });
      nonempty = true;
    } else {
      const directory = await opendir(path);
      try {
        nonempty = (await directory.read()) !== null;
      } finally {
        await directory.close();
      }
    }
  }
  const folder = kind === "file" ? dirname(path) : path;
  return Object.freeze({ kind, path, folder, stem, nonempty });
}
