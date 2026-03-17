import { readFile } from "node:fs/promises";
import { posix as pathPosix } from "node:path";
import type { Readable } from "node:stream";

import { XMLParser, XMLValidator } from "fast-xml-parser";
import yauzl, { type Entry, type ZipFile } from "yauzl";

export interface DocxCoreMetadata {
  title?: string;
  creator?: string;
  subject?: string;
  description?: string;
  lastModifiedBy?: string;
  created?: string;
  modified?: string;
  application?: string;
}

export type ReadDocxCoreMetadataResult =
  | {
      metadata?: DocxCoreMetadata;
      warnings: string[];
    }
  | {
      reason: "docx_extract_error";
    };

const DOCX_PACKAGE_RELS_PATH = "/_rels/.rels";
const DOCX_CONTENT_TYPES_PATH = "/[Content_Types].xml";
const DOCX_DEFAULT_CORE_PROPERTIES_PATH = "/docProps/core.xml";
const DOCX_DEFAULT_APP_PROPERTIES_PATH = "/docProps/app.xml";
const DOCX_CORE_PROPERTIES_CONTENT_TYPE = "application/vnd.openxmlformats-package.core-properties+xml";
const DOCX_EXTENDED_PROPERTIES_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.extended-properties+xml";
const MAX_DOCX_METADATA_PART_BYTES = 256 * 1024;
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  removeNSPrefix: true,
  trimValues: true,
});

type RelationshipTargetPaths = {
  targets: Set<string>;
};

type ContentTypeTargetPaths = {
  appPropertiesPaths: string[];
  corePropertiesPaths: string[];
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

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

async function readDocxXmlParts(buffer: Buffer): Promise<Map<string, string> | { reason: "docx_extract_error" }> {
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

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function getElementText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const normalized = normalizeWhitespace(value);
    return normalized || undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const textValue = (value as Record<string, unknown>)["#text"];
  if (typeof textValue !== "string") {
    return undefined;
  }

  const normalized = normalizeWhitespace(textValue);
  return normalized || undefined;
}

function parseRelationshipTargetPaths(xml: string): RelationshipTargetPaths | undefined {
  try {
    if (XMLValidator.validate(xml) !== true) {
      return undefined;
    }
    const parsed = xmlParser.parse(xml) as {
      Relationships?: { Relationship?: Record<string, unknown> | Record<string, unknown>[] };
    };
    const relationships = asArray(parsed.Relationships?.Relationship);
    const targets = new Set<string>();

    for (const relationship of relationships) {
      const target = relationship["@_Target"];
      const targetMode = relationship["@_TargetMode"];
      if (typeof targetMode === "string" && targetMode.toLowerCase() === "external") {
        continue;
      }
      if (typeof target !== "string") {
        continue;
      }
      targets.add(normalizePackagePartPath(target));
    }

    return { targets };
  } catch {
    return undefined;
  }
}

function parseContentTypeTargetPaths(xml: string): ContentTypeTargetPaths | undefined {
  try {
    if (XMLValidator.validate(xml) !== true) {
      return undefined;
    }
    const parsed = xmlParser.parse(xml) as {
      Types?: { Override?: Record<string, unknown> | Record<string, unknown>[] };
    };
    const overrides = asArray(parsed.Types?.Override);
    const targets: ContentTypeTargetPaths = {
      appPropertiesPaths: [],
      corePropertiesPaths: [],
    };

    for (const override of overrides) {
      const partName = override["@_PartName"];
      const contentType = override["@_ContentType"];
      if (typeof partName !== "string" || typeof contentType !== "string") {
        continue;
      }
      const normalizedPartName = normalizePackagePartPath(partName);
      if (contentType === DOCX_CORE_PROPERTIES_CONTENT_TYPE) {
        targets.corePropertiesPaths.push(normalizedPartName);
      } else if (contentType === DOCX_EXTENDED_PROPERTIES_CONTENT_TYPE) {
        targets.appPropertiesPaths.push(normalizedPartName);
      }
    }

    return targets;
  } catch {
    return undefined;
  }
}

function resolveMetadataPartPath(options: {
  defaultPath: string;
  fallbackSuffix: string;
  parts: Map<string, string>;
  relationshipTargets?: Set<string>;
  typedPaths: string[];
}): string | undefined {
  for (const typedPath of options.typedPaths) {
    if (options.relationshipTargets?.has(typedPath) && options.parts.has(typedPath)) {
      return typedPath;
    }
  }

  for (const typedPath of options.typedPaths) {
    if (options.parts.has(typedPath)) {
      return typedPath;
    }
  }

  if (options.relationshipTargets) {
    for (const relationshipTarget of options.relationshipTargets) {
      if (relationshipTarget.endsWith(options.fallbackSuffix) && options.parts.has(relationshipTarget)) {
        return relationshipTarget;
      }
    }
  }

  return options.parts.has(options.defaultPath) ? options.defaultPath : undefined;
}

function parseCoreProperties(xml: string): DocxCoreMetadata | undefined {
  try {
    if (XMLValidator.validate(xml) !== true) {
      return undefined;
    }
    const parsed = xmlParser.parse(xml) as { coreProperties?: Record<string, unknown> };
    const root = parsed.coreProperties;
    if (!root || typeof root !== "object" || Array.isArray(root)) {
      return undefined;
    }

    const metadata: DocxCoreMetadata = {
      title: getElementText(root.title),
      creator: getElementText(root.creator),
      subject: getElementText(root.subject),
      description: getElementText(root.description),
      lastModifiedBy: getElementText(root.lastModifiedBy),
      created: getElementText(root.created),
      modified: getElementText(root.modified),
    };

    return Object.values(metadata).some((value) => Boolean(value)) ? metadata : {};
  } catch {
    return undefined;
  }
}

function parseExtendedPropertiesApplication(xml: string | undefined): string | undefined {
  if (!xml) {
    return undefined;
  }

  try {
    if (XMLValidator.validate(xml) !== true) {
      return undefined;
    }
    const parsed = xmlParser.parse(xml) as { Properties?: Record<string, unknown> };
    return getElementText(parsed.Properties?.Application);
  } catch {
    return undefined;
  }
}

export async function readDocxCoreMetadata(path: string): Promise<ReadDocxCoreMetadataResult> {
  let buffer: Buffer;
  try {
    buffer = await readFile(path);
  } catch {
    return { reason: "docx_extract_error" };
  }

  const parts = await readDocxXmlParts(buffer);
  if ("reason" in parts) {
    return parts;
  }

  const relationshipTargets = parseRelationshipTargetPaths(parts.get(DOCX_PACKAGE_RELS_PATH) ?? "");
  const contentTypeTargets = parseContentTypeTargetPaths(parts.get(DOCX_CONTENT_TYPES_PATH) ?? "");
  const corePropertiesPath = resolveMetadataPartPath({
    defaultPath: DOCX_DEFAULT_CORE_PROPERTIES_PATH,
    fallbackSuffix: "/core.xml",
    parts,
    relationshipTargets: relationshipTargets?.targets,
    typedPaths: contentTypeTargets?.corePropertiesPaths ?? [],
  });
  const appPropertiesPath = resolveMetadataPartPath({
    defaultPath: DOCX_DEFAULT_APP_PROPERTIES_PATH,
    fallbackSuffix: "/app.xml",
    parts,
    relationshipTargets: relationshipTargets?.targets,
    typedPaths: contentTypeTargets?.appPropertiesPaths ?? [],
  });

  const metadata = parseCoreProperties(corePropertiesPath ? parts.get(corePropertiesPath) ?? "" : "");
  if (!metadata) {
    return { warnings: ["docx_metadata_unavailable"] };
  }

  const application = parseExtendedPropertiesApplication(
    appPropertiesPath ? parts.get(appPropertiesPath) : undefined,
  );
  if (application) {
    metadata.application = application;
  }

  const warnings: string[] = [];
  if (!metadata.title) {
    warnings.push("docx_metadata_missing_title");
  }

  return {
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    warnings,
  };
}
