import { posix as pathPosix } from "node:path";
import type { Readable } from "node:stream";

import yauzl, { type Entry, type ZipFile } from "yauzl";

const MAX_DOCX_METADATA_PART_BYTES = 256 * 1024;

function normalizePackagePartPath(value: string): string {
  const normalized = pathPosix.normalize(value.startsWith("/") ? value : `/${value}`);
  return normalized === "." ? "/" : normalized;
}

function shouldReadXmlLikePart(entry: Entry): boolean {
  if (entry.fileName.endsWith("/")) {
    return false;
  }
  if (entry.uncompressedSize > MAX_DOCX_METADATA_PART_BYTES) {
    return false;
  }
  return entry.fileName.endsWith(".xml") || entry.fileName.endsWith(".rels");
}

function readZipFileFromBuffer(buffer: Buffer): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      {
        autoClose: true,
        decodeStrings: true,
        lazyEntries: true,
        validateEntrySizes: true,
      },
      (error: Error | null, zipFile?: ZipFile | null) => {
        if (error || !zipFile) {
          reject(error ?? new Error("Failed to open DOCX ZIP package."));
          return;
        }
        resolve(zipFile);
      },
    );
  });
}

function readZipEntryText(zipFile: ZipFile, entry: Entry): Promise<string> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error: Error | null, stream?: Readable | null) => {
      if (error || !stream) {
        reject(error ?? new Error(`Failed to read ZIP entry: ${entry.fileName}`));
        return;
      }

      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer | string | Uint8Array) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.once("error", reject);
      stream.once("end", () => {
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
    });
  });
}

export async function readDocxXmlParts(
  buffer: Buffer,
): Promise<Map<string, string> | { reason: "docx_extract_error" }> {
  let zipFile: ZipFile | undefined;

  try {
    const openedZipFile = await readZipFileFromBuffer(buffer);
    zipFile = openedZipFile;
    return await new Promise<Map<string, string> | { reason: "docx_extract_error" }>((resolve) => {
      const parts = new Map<string, string>();

      openedZipFile.once("error", () => {
        resolve({ reason: "docx_extract_error" });
      });
      openedZipFile.once("end", () => {
        resolve(parts);
      });
      openedZipFile.on("entry", async (entry: Entry) => {
        if (!shouldReadXmlLikePart(entry)) {
          openedZipFile.readEntry();
          return;
        }

        try {
          const text = await readZipEntryText(openedZipFile, entry);
          parts.set(normalizePackagePartPath(entry.fileName), text);
          openedZipFile.readEntry();
        } catch {
          resolve({ reason: "docx_extract_error" });
        }
      });

      openedZipFile.readEntry();
    });
  } catch {
    return { reason: "docx_extract_error" };
  } finally {
    try {
      zipFile?.close();
    } catch {
      // ignore cleanup issues
    }
  }
}
