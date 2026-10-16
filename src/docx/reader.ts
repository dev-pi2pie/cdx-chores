import { posix } from "node:path";

import { readDocxCoreMetadataFromParts } from "../adapters/docx/ooxml-metadata";
import { normalizePackagePartPath } from "../adapters/docx/ooxml-part-path";
import { resolveDocxMetadataPartPaths } from "../adapters/docx/ooxml-part-discovery";
import { documentBodyFacts } from "./body";
import { DocxLimitError, resolveDocxLimits, type DocxLimits } from "./limits";
import { openGuardedDocxPackage, type GuardedDocxPackage } from "./package";
import { headingResolver } from "./styles";
import type { DocxReadResult } from "./types";
import { children, first, parseXml, type Element } from "./xml";
import { XmlBudget } from "./xml-budget";

export type { DocxReadResult } from "./types";

const METADATA_PART_BYTES = 256 * 1024;

/** Inline parser entry; the runtime owner supplies process/deadline containment. */
export async function readDocxDocument(
  buffer: Buffer,
  overrides?: DocxLimits,
): Promise<DocxReadResult> {
  let archive: GuardedDocxPackage | undefined;
  try {
    const limits = resolveDocxLimits(overrides);
    archive = await openGuardedDocxPackage(buffer, limits);
    const opened = archive;
    const budget = new XmlBudget(limits);
    const parsed = new Map<string, Element | undefined>();
    async function xml(path: string): Promise<Element | undefined> {
      if (parsed.has(path)) return parsed.get(path);
      const text = await opened.readText(path);
      const value = text === undefined ? undefined : parseXml(text, budget, path);
      parsed.set(path, value);
      return value;
    }
    async function relatedPath(relationshipsPath: string, kind: string, base = "/") {
      for (const relationship of children(await xml(relationshipsPath))) {
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
        const path = normalizePackagePartPath(
          target.startsWith("/") ? target : `${base}/${target}`,
        );
        if (opened.entries.has(path)) return path;
      }
      return kind === "officeDocument" ? "/word/document.xml" : `/word/${kind}.xml`;
    }
    const mainPath = await relatedPath("/_rels/.rels", "officeDocument");
    const document = await xml(mainPath);
    const body = document?.name === "w:document" ? first(document, "w:body") : undefined;
    if (!body) return { ok: false, diagnostic: "docx_main_document_unavailable" };
    const directory = posix.dirname(mainPath);
    const relationshipsPath = `${directory}/_rels/${posix.basename(mainPath)}.rels`;
    const stylePath = await relatedPath(relationshipsPath, "styles", directory);
    const headings = headingResolver(
      await opened.readText(stylePath),
      await opened.readText("/mammoth/style-map"),
      limits,
      budget,
      stylePath,
    );
    const embeddedImages = new Set<string>();
    for (const relationship of children(await xml(relationshipsPath))) {
      if (
        relationship.attributes.get("Type")?.endsWith("/image") &&
        relationship.attributes.get("TargetMode")?.toLowerCase() !== "external"
      ) {
        const id = relationship.attributes.get("Id");
        if (id) embeddedImages.add(id);
      }
    }
    // Preserve metadata eligibility independently of the larger content cap.
    const metadataParts = new Map<string, string>();
    for (const [path, entry] of opened.entries) {
      if (
        !entry.fileName.endsWith("/") &&
        /\.(xml|rels)$/.test(entry.fileName) &&
        entry.uncompressedSize <= METADATA_PART_BYTES
      )
        metadataParts.set(path, "");
    }
    async function metadataPart(path: string): Promise<void> {
      if (!metadataParts.has(path)) return;
      const text = await opened.readText(path);
      if (text === undefined) return;
      try {
        budget.inspect(path, text);
        metadataParts.set(path, text);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "docx_xml_invalid") throw error;
        // Optional malformed metadata remains unavailable, preserving warnings.
      }
    }
    await metadataPart("/_rels/.rels");
    await metadataPart("/[Content_Types].xml");
    const metadataPaths = resolveDocxMetadataPartPaths(metadataParts);
    if (metadataPaths.corePropertiesPath) await metadataPart(metadataPaths.corePropertiesPath);
    if (metadataPaths.appPropertiesPath) await metadataPart(metadataPaths.appPropertiesPath);
    return {
      ok: true,
      facts: {
        ...documentBodyFacts(body, headings, embeddedImages),
        metadataResult: readDocxCoreMetadataFromParts(metadataParts),
      },
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return {
      ok: false,
      diagnostic:
        error instanceof DocxLimitError
          ? error.message
          : [
                "docx_xml_invalid",
                "docx_xml_declaration_unsupported",
                "docx_style_map_unsupported",
              ].includes(code)
            ? code
            : "docx_initial_reader_error",
    };
  } finally {
    await archive?.close();
  }
}
