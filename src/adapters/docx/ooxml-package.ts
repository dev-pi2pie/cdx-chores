import type { Readable } from "node:stream";

import yauzl, { type Entry, type ZipFile } from "yauzl";
import { normalizePackagePartPath } from "./ooxml-part-path";

const MAX_DOCX_METADATA_PART_BYTES = 256 * 1024;
type XmlTextEncoding = "utf-8" | "utf-16" | "utf-16le" | "utf-16be";

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

function detectXmlEncoding(buffer: Buffer): XmlTextEncoding {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return "utf-8";
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return "utf-16le";
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return "utf-16be";
  }
  if (buffer.length >= 4 && buffer[0] === 0x3c && buffer[1] === 0x00 && buffer[2] === 0x3f && buffer[3] === 0x00) {
    return "utf-16le";
  }
  if (buffer.length >= 4 && buffer[0] === 0x00 && buffer[1] === 0x3c && buffer[2] === 0x00 && buffer[3] === 0x3f) {
    return "utf-16be";
  }

  const declarationPrefix = buffer.toString("latin1", 0, Math.min(buffer.length, 256));
  const encodingMatch = declarationPrefix.match(/encoding\s*=\s*["']([^"']+)["']/i);
  const normalized = encodingMatch?.[1]?.trim().toLowerCase();
  if (!normalized) {
    return "utf-8";
  }
  if (normalized === "utf8") {
    return "utf-8";
  }
  if (normalized === "utf16" || normalized === "utf-16") {
    return "utf-16";
  }
  if (normalized === "utf16le") {
    return "utf-16le";
  }
  if (normalized === "utf16be") {
    return "utf-16be";
  }
  return normalized === "utf-8" ? normalized : "utf-8";
}

function decodeUtf16Be(buffer: Buffer): string {
  const withoutBom =
    buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff ? buffer.subarray(2) : buffer;
  const swapped = Buffer.from(withoutBom);
  for (let index = 0; index + 1 < swapped.length; index += 2) {
    const current = swapped[index];
    swapped[index] = swapped[index + 1] ?? 0;
    swapped[index + 1] = current ?? 0;
  }
  return swapped.toString("utf16le");
}

function decodeXmlBuffer(buffer: Buffer): string {
  const encoding = detectXmlEncoding(buffer);
  if (encoding === "utf-16be") {
    return decodeUtf16Be(buffer);
  }
  if (encoding === "utf-16le") {
    const withoutBom =
      buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe ? buffer.subarray(2) : buffer;
    return withoutBom.toString("utf16le");
  }
  try {
    return new TextDecoder(encoding).decode(buffer);
  } catch {
    return buffer.toString("utf8");
  }
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
        resolve(decodeXmlBuffer(Buffer.concat(chunks)));
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
