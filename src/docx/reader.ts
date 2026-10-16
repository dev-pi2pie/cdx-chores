import { documentBodyFacts } from "./body";
import type { DocxBodyInput } from "./body-types";
import { ContentLoader } from "./content-loading";
import { DocxLimitError, resolveDocxLimits, type DocxLimits } from "./limits";
import { readMetadata } from "./metadata";
import { openGuardedDocxPackage, type GuardedDocxPackage } from "./package";
import type { DocxReadResult } from "./types";
import { first } from "./xml";
import { XmlBudget } from "./xml-budget";

export type { DocxReadResult } from "./types";

/** Inline parser entry; its runtime owner supplies deadline/process containment. */
export async function readDocxDocument(
  buffer: Buffer,
  overrides?: DocxLimits,
): Promise<DocxReadResult> {
  let archive: GuardedDocxPackage | undefined;
  try {
    const limits = resolveDocxLimits(overrides);
    archive = await openGuardedDocxPackage(buffer, limits);
    const budget = new XmlBudget(limits);
    const loader = new ContentLoader(archive, budget);
    const loaded = await loader.parts();
    const body =
      loaded.document?.name === "w:document" ? first(loaded.document, "w:body") : undefined;
    if (!body) return { ok: false, diagnostic: "docx_main_document_unavailable" };
    const imageTargets = new Map<string, string>();
    const hyperlinkTargets = new Map<string, string>();
    for (const [part, source] of [
      [loaded.paths.main, "document"],
      [loaded.paths.footnotes, "footnotes"],
      [loaded.paths.endnotes, "endnotes"],
      [loaded.paths.comments, "comments"],
    ] as const) {
      for (const [id, path] of await loader.imageTargets(part, source)) imageTargets.set(id, path);
      for (const [id, target] of await loader.hyperlinkTargets(part, source))
        hyperlinkTargets.set(id, target);
    }
    const styleMapBytes = await archive.readContentBytes("/mammoth/style-map");
    const styleMap =
      styleMapBytes === undefined ? undefined : new TextDecoder("utf-8").decode(styleMapBytes);
    const imageCollector = new Set<string>();
    const input: DocxBodyInput = {
      body,
      styles: loaded.styles,
      numbering: loaded.numbering,
      comments: loaded.comments,
      styleMap,
      footnotes: loaded.footnotes,
      endnotes: loaded.endnotes,
      embeddedImages: new Set(imageTargets.keys()),
      imageCollector,
      hyperlinkTargets,
      limits,
    };
    let facts = documentBodyFacts(input);
    const metadataResult = await readMetadata(archive, budget);
    const validImages = new Set<string>();
    for (const id of imageCollector) {
      const path = imageTargets.get(id);
      if (path && (await archive.readContentBytes(path)) !== undefined) validImages.add(id);
    }
    if (imageCollector.size)
      facts = documentBodyFacts({
        ...input,
        embeddedImages: validImages,
        imageCollector: undefined,
      });
    return { ok: true, facts: { ...facts, metadataResult } };
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
                "docx_symbol_font_missing",
                "docx_note_missing",
                "docx_comment_missing",
                "docx_main_document_unavailable",
              ].includes(code)
            ? code
            : "docx_initial_reader_error",
    };
  } finally {
    await archive?.close();
  }
}
