import type { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { posix } from "node:path";
import type { Entry, ZipFile } from "yauzl";

import { decodeXmlBuffer, readZipFileFromBuffer } from "../adapters/docx/ooxml-package";
import { normalizePackagePartPath } from "../adapters/docx/ooxml-part-path";
import { checkDocxLimit, type DocxLimits } from "./limits";

export interface GuardedDocxPackage {
  readonly entries: ReadonlyMap<string, Entry>;
  /** Preserve URI escapes in content-part filenames. */
  readonly contentEntries: ReadonlyMap<string, Entry>;
  /** Last metadata-eligible physical entry, independently of content limits. */
  readonly metadataEntries: ReadonlyMap<string, Entry>;
  readonly closed: boolean;
  readBytes(path: string): Promise<Buffer | undefined>;
  readContentBytes(path: string): Promise<Buffer | undefined>;
  readText(path: string): Promise<string | undefined>;
  readMetadataText(path: string): Promise<string | undefined>;
  close(): Promise<void>;
}

function nextEntry(zip: ZipFile): Promise<Entry | undefined> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      zip.removeListener("entry", onEntry);
      zip.removeListener("end", onEnd);
      zip.removeListener("error", onError);
    };
    const onEntry = (entry: Entry) => {
      cleanup();
      resolve(entry);
    };
    const onEnd = () => {
      cleanup();
      resolve(undefined);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    zip.once("entry", onEntry);
    zip.once("end", onEnd);
    zip.once("error", onError);
    zip.readEntry();
  });
}

/** Index headers once; inflate only explicitly selected parts under byte limits. */
export async function openGuardedDocxPackage(
  buffer: Buffer,
  limits: DocxLimits,
): Promise<GuardedDocxPackage> {
  checkDocxLimit(buffer.length, "compressedInputBytes", limits);
  const zip = await readZipFileFromBuffer(buffer, false);
  const entries = new Map<string, Entry>();
  const contentEntries = new Map<string, Entry>();
  const metadataEntries = new Map<string, Entry>();
  const active = new Set<Readable>();
  const opening = new Set<Promise<Readable>>();
  const tasks = new Set<Promise<Buffer | undefined>>();
  const reads = new Map<Entry, Promise<Buffer | undefined>>();
  let closed = false;
  let closing: Promise<void> | undefined;
  let failure: Error | undefined;
  let totalBytes = 0;
  zip.on("error", (error: Error) => {
    failure = error;
    for (const stream of active) stream.destroy(error);
  });
  const close = (): Promise<void> => {
    if (closing) return closing;
    closed = true;
    for (const stream of active) stream.destroy();
    // Yauzl's BufferSlicer releases its reference synchronously and does not
    // emit an archive close event. Await the actual streams and pending opens.
    zip.close();
    closing = (async () => {
      await Promise.allSettled(opening);
      for (const stream of active) stream.destroy();
      await Promise.all(
        [...active].map((stream) => finished(stream, { cleanup: true }).catch(() => {})),
      );
      await Promise.allSettled(tasks);
      active.clear();
      reads.clear();
    })();
    return closing;
  };
  try {
    let count = 0;
    for (;;) {
      if (failure) throw failure;
      const entry = await nextEntry(zip);
      if (!entry) break;
      checkDocxLimit(++count, "entryCount", limits);
      const part = normalizePackagePartPath(entry.fileName);
      entries.set(part, entry);
      contentEntries.set(`/${posix.normalize(entry.fileName)}`, entry);
      if (
        !entry.fileName.endsWith("/") &&
        /\.(xml|rels)$/.test(entry.fileName) &&
        entry.uncompressedSize <= 256 * 1024
      )
        metadataEntries.set(part, entry);
    }
    if (failure) throw failure;
  } catch (error) {
    await close();
    throw error;
  }

  async function read(entry: Entry): Promise<Buffer | undefined> {
    let stream: Readable | undefined;
    try {
      if (closed || failure) throw new Error("docx_package_unavailable");
      if (entry.fileName.endsWith("/")) return undefined;
      checkDocxLimit(entry.uncompressedSize, "maxPartDecompressedBytes", limits);
      const pendingOpen = new Promise<Readable>((resolve, reject) => {
        zip.openReadStream(entry, (error, opened) => {
          if (error || !opened) reject(error ?? new Error("docx_part_unavailable"));
          else if (closed || failure) {
            opened.destroy();
            void finished(opened, { cleanup: true })
              .catch(() => {})
              .then(() => reject(failure ?? new Error("docx_package_unavailable")));
          } else {
            active.add(opened);
            resolve(opened);
          }
        });
      });
      opening.add(pendingOpen);
      try {
        stream = await pendingOpen;
      } finally {
        opening.delete(pendingOpen);
      }
      const chunks: Buffer[] = [];
      let partBytes = 0;
      for await (const chunk of stream) {
        if (closed || failure) throw new Error("docx_package_unavailable");
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
        partBytes += bytes.length;
        totalBytes += bytes.length;
        checkDocxLimit(partBytes, "maxPartDecompressedBytes", limits);
        checkDocxLimit(totalBytes, "totalDecompressedBytes", limits);
        chunks.push(bytes);
      }
      if (failure) throw failure;
      return Buffer.concat(chunks, partBytes);
    } catch (error) {
      // The raw task must settle before close can finish; the cached wrapper
      // below waits for cleanup before exposing this rejection to its caller.
      void close().catch(() => {});
      throw error;
    } finally {
      if (stream) {
        stream.destroy();
        await finished(stream, { cleanup: true }).catch(() => {});
        active.delete(stream);
      }
    }
  }
  function selected(entry: Entry | undefined): Promise<Buffer | undefined> {
    if (closed) return Promise.reject(new Error("docx_package_unavailable"));
    if (!entry) return Promise.resolve(undefined);
    let pending = reads.get(entry);
    if (!pending) {
      const task = read(entry);
      tasks.add(task);
      void task.then(
        () => tasks.delete(task),
        () => tasks.delete(task),
      );
      pending = task.catch(async (error) => {
        await close();
        throw error;
      });
      reads.set(entry, pending);
    }
    return pending;
  }
  function readBytes(path: string) {
    return selected(entries.get(normalizePackagePartPath(path)));
  }
  return {
    entries,
    contentEntries,
    metadataEntries,
    get closed() {
      return closed;
    },
    close,
    readBytes,
    readContentBytes(path) {
      return selected(contentEntries.get(path));
    },
    async readText(path) {
      const bytes = await readBytes(path);
      return bytes === undefined ? undefined : decodeXmlBuffer(bytes);
    },
    async readMetadataText(path) {
      const bytes = await selected(metadataEntries.get(normalizePackagePartPath(path)));
      return bytes === undefined ? undefined : decodeXmlBuffer(bytes);
    },
  };
}
