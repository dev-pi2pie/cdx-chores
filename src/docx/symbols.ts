import { hex } from "dingbat-to-unicode";

import type { Element } from "./xml";

/** Preserve the baseline mapper's permissive parsing and uppercase F0 retry. */
export function readSymbol(node: Element, diagnostics: Set<string>): string {
  const font = node.attributes.get("w:font");
  if (font === undefined) throw new Error("docx_symbol_font_missing");
  const character = node.attributes.get("w:char") ?? "";
  let mapped = hex(font, character);
  if (mapped === undefined && /^F0..$/.test(character)) mapped = hex(font, character.slice(2));
  if (mapped) return mapped.string;
  diagnostics.add("docx_symbol_unsupported");
  return "";
}
