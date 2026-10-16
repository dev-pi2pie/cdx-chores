import type { DocxLimits } from "./limits";
import type { DocxDocumentFacts } from "./types";
import type { Element } from "./xml";

export interface DocxBodyInput {
  body: Element;
  styles?: Element;
  numbering?: Element;
  styleMap?: string;
  comments?: Element;
  footnotes?: Element;
  endnotes?: Element;
  /** Keys qualify relationship IDs by document, footnotes, endnotes, or comments source. */
  embeddedImages: ReadonlySet<string>;
  /** Populated only for images reached by the HTML evidence projection. */
  imageCollector?: Set<string>;
  /** Inert targets allow equivalent adjacent link paths to share projection nodes. */
  hyperlinkTargets?: ReadonlyMap<string, string>;
  limits: DocxLimits;
}

export type DocxBodyFacts = Pick<
  DocxDocumentFacts,
  "headings" | "rawText" | "hasContent" | "diagnostics"
>;
