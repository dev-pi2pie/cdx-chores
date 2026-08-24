import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative } from "node:path";

import {
  PAGE_NUMBER_LAB_MARKER_CONTENT,
  PAGE_NUMBER_LAB_MARKER_NAME,
} from "../../../test/fixtures/markdown-pdf/page-number-renderer-contract";
import type { RunRendererEvidenceOptions } from "./contract";
import { labPrefix } from "./contract";

export async function initializeEvidenceLaboratory(
  options: Pick<RunRendererEvidenceOptions, "temporaryRoot" | "uniqueId" | "initializeMarker"> = {},
): Promise<string> {
  const temporaryRoot = await realpath(options.temporaryRoot ?? tmpdir());
  const labRoot = join(temporaryRoot, `${labPrefix}${options.uniqueId ?? randomUUID()}`);
  await mkdir(labRoot);
  try {
    const markerPath = join(labRoot, PAGE_NUMBER_LAB_MARKER_NAME);
    if (options.initializeMarker) await options.initializeMarker(markerPath);
    else
      await writeFile(markerPath, PAGE_NUMBER_LAB_MARKER_CONTENT, { encoding: "utf8", flag: "wx" });
    if ((await readFile(markerPath, "utf8")) !== PAGE_NUMBER_LAB_MARKER_CONTENT)
      throw new Error("Ownership marker verification failed.");
    return await realpath(labRoot);
  } catch (error) {
    await rm(labRoot, { recursive: true, force: true });
    throw error;
  }
}

async function assertSafeLaboratory(labPath: string, temporaryRoot = tmpdir()): Promise<string> {
  const canonicalTemporaryRoot = await realpath(temporaryRoot);
  const canonicalLab = await realpath(labPath);
  const relativePath = relative(canonicalTemporaryRoot, canonicalLab);
  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath) ||
    dirname(canonicalLab) !== canonicalTemporaryRoot ||
    !basename(canonicalLab).startsWith(labPrefix) ||
    (await lstat(canonicalLab)).isSymbolicLink()
  )
    throw new Error("Refusing to clean an unsafe renderer-evidence laboratory path.");
  let marker: string;
  try {
    marker = await readFile(join(canonicalLab, PAGE_NUMBER_LAB_MARKER_NAME), "utf8");
  } catch {
    throw new Error("Refusing to clean a renderer-evidence laboratory without its marker.");
  }
  if (marker !== PAGE_NUMBER_LAB_MARKER_CONTENT)
    throw new Error("Refusing to clean a renderer-evidence laboratory with a foreign marker.");
  return canonicalLab;
}

export async function closeRetainedEvidenceLaboratory(
  labPath: string,
  temporaryRoot = tmpdir(),
): Promise<void> {
  const canonicalLab = await assertSafeLaboratory(labPath, temporaryRoot);
  const detachedPath = join(
    dirname(canonicalLab),
    `.${basename(canonicalLab)}.cleanup-${randomUUID()}`,
  );
  await rename(canonicalLab, detachedPath);
  try {
    const detached = await lstat(detachedPath);
    const marker = await readFile(join(detachedPath, PAGE_NUMBER_LAB_MARKER_NAME), "utf8");
    if (
      !detached.isDirectory() ||
      detached.isSymbolicLink() ||
      marker !== PAGE_NUMBER_LAB_MARKER_CONTENT
    )
      throw new Error("Refusing to remove a detached laboratory whose ownership changed.");
  } catch (error) {
    try {
      await rename(detachedPath, canonicalLab);
    } catch {
      throw new Error("Detached laboratory ownership changed and restoration failed.", {
        cause: error,
      });
    }
    throw error;
  }
  await rm(detachedPath, { recursive: true });
}
