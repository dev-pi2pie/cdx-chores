import { posix } from "node:path";

import { readDocxCoreMetadataFromParts } from "../adapters/docx/ooxml-metadata";
import { normalizePackagePartPath } from "../adapters/docx/ooxml-part-path";
import { readDocxXmlParts } from "../adapters/docx/ooxml-package";
import { documentBodyFacts } from "./body";
import { headingResolver } from "./styles";
import type { DocxReadResult } from "./types";
import { children, first, parseXml } from "./xml";

export type { DocxReadResult } from "./types";

function relationships(parts: Map<string, string>, path: string) {
  const xml = parts.get(path);
  return children(xml === undefined ? undefined : parseXml(xml));
}

function relatedPath(
  parts: Map<string, string>,
  relationshipsPath: string,
  kind: string,
  base = "/",
) {
  for (const relationship of relationships(parts, relationshipsPath)) {
    if (
      relationship.name !== "rels:Relationship" ||
      relationship.attributes.get("TargetMode")?.toLowerCase() === "external"
    )
      continue;
    if (
      relationship.attributes.get("Type") !==
      `http://schemas.openxmlformats.org/officeDocument/2006/relationships/${kind}`
    )
      continue;
    const target = relationship.attributes.get("Target");
    if (!target) continue;
    const path = normalizePackagePartPath(target.startsWith("/") ? target : `${base}/${target}`);
    if (parts.has(path)) return path;
  }
  return kind === "officeDocument" ? "/word/document.xml" : `/word/${kind}.xml`;
}

/** Private unguarded initial reader for the identified trusted evaluation slice. */
export async function readDocxDocument(buffer: Buffer): Promise<DocxReadResult> {
  try {
    const parts = await readDocxXmlParts(buffer, { includeEmbeddedStyleMap: true });
    if ("reason" in parts) return { ok: false, diagnostic: parts.reason };
    const mainPath = relatedPath(parts, "/_rels/.rels", "officeDocument");
    const mainXml = parts.get(mainPath);
    const document = mainXml === undefined ? undefined : parseXml(mainXml);
    const body = document?.name === "w:document" ? first(document, "w:body") : undefined;
    if (!body) return { ok: false, diagnostic: "docx_main_document_unavailable" };
    const directory = posix.dirname(mainPath);
    const relationshipsPath = `${directory}/_rels/${posix.basename(mainPath)}.rels`;
    const stylePath = relatedPath(parts, relationshipsPath, "styles", directory);
    const headings = headingResolver(parts.get(stylePath), parts.get("/mammoth/style-map"));
    const embeddedImages = new Set<string>();
    for (const relationship of relationships(parts, relationshipsPath)) {
      if (
        relationship.attributes.get("Type")?.endsWith("/image") &&
        relationship.attributes.get("TargetMode")?.toLowerCase() !== "external"
      ) {
        const id = relationship.attributes.get("Id");
        if (id) embeddedImages.add(id);
      }
    }
    return {
      ok: true,
      facts: {
        ...documentBodyFacts(body, headings, embeddedImages),
        metadataResult: readDocxCoreMetadataFromParts(parts),
      },
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return {
      ok: false,
      diagnostic:
        code === "docx_xml_invalid" || code === "docx_style_map_unsupported"
          ? code
          : "docx_initial_reader_error",
    };
  }
}
