import { readFile } from "node:fs/promises";
import type { DocxCoreMetadata } from "./ooxml-metadata-parser";
import {
  parseDocxCoreProperties,
  parseDocxExtendedPropertiesApplication,
} from "./ooxml-metadata-parser";
import { readDocxXmlParts } from "./ooxml-package";
import { resolveDocxMetadataPartPaths } from "./ooxml-part-discovery";

export type { DocxCoreMetadata } from "./ooxml-metadata-parser";

export type ReadDocxCoreMetadataResult =
  | {
      metadata?: DocxCoreMetadata;
      warnings: string[];
    }
  | {
      reason: "docx_extract_error";
    };

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

  const { appPropertiesPath, corePropertiesPath } = resolveDocxMetadataPartPaths(parts);

  const metadata = parseDocxCoreProperties(
    corePropertiesPath ? (parts.get(corePropertiesPath) ?? "") : "",
  );
  if (!metadata) {
    return { warnings: ["docx_metadata_unavailable"] };
  }

  const application = parseDocxExtendedPropertiesApplication(
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
