import type { DocxLimits } from "./limits";
import { StyleWork } from "./style-work";
import { children, first, type Element } from "./xml";

export interface ParagraphNumbering {
  isOrdered: boolean;
  levelIndex: number;
}

interface NumberingLevel extends ParagraphNumbering {
  paragraphStyleId?: string;
}

interface AbstractNumbering {
  levels: Record<string, NumberingLevel>;
  styleLink?: string;
}

/** Resolve only the numbering facts used by list selectors in the heading projection. */
export function createNumberingResolver(
  numbering: Element | undefined,
  styles: Element | undefined,
  limits: DocxLimits,
): (node: Element) => ParagraphNumbering | undefined {
  const abstracts: Record<string, AbstractNumbering> = Object.create(null);
  const nums = new Map<string | undefined, string | undefined>();
  const styleNums = new Map<string | undefined, string | undefined>();

  for (const abstract of children(numbering)) {
    if (abstract.name !== "w:abstractNum") continue;
    const levels: Record<string, NumberingLevel> = Object.create(null);
    let unindexed: NumberingLevel | undefined;
    for (const level of children(abstract)) {
      if (level.name !== "w:lvl") continue;
      const index = level.attributes.get("w:ilvl");
      const value: NumberingLevel = {
        isOrdered: first(level, "w:numFmt")?.attributes.get("w:val") !== "bullet",
        levelIndex: Number(index ?? "0"),
        paragraphStyleId: first(level, "w:pStyle")?.attributes.get("w:val"),
      };
      if (index === undefined) unindexed = value;
      else levels[index] = value;
    }
    if (unindexed !== undefined && levels["0"] === undefined) levels["0"] = unindexed;
    abstracts[String(abstract.attributes.get("w:abstractNumId"))] = {
      levels,
      styleLink: first(abstract, "w:numStyleLink")?.attributes.get("w:val"),
    };
  }

  for (const num of children(numbering)) {
    if (num.name !== "w:num") continue;
    const abstract = first(num, "w:abstractNumId");
    if (!abstract) throw new Error("docx_numbering_invalid");
    // The baseline ignores lvlOverride, including its replacement level and start value.
    nums.set(num.attributes.get("w:numId"), abstract.attributes.get("w:val"));
  }

  for (const style of children(styles)) {
    if (style.name !== "w:style" || style.attributes.get("w:type") !== "numbering") continue;
    const id = style.attributes.get("w:styleId");
    if (styleNums.has(id)) continue;
    const properties = first(first(style, "w:pPr"), "w:numPr");
    styleNums.set(id, first(properties, "w:numId")?.attributes.get("w:val"));
  }

  const styleLevels = new Map<string, NumberingLevel>();
  // Object enumeration preserves the baseline's numeric-ID order for duplicate style links.
  for (const abstract of Object.values(abstracts)) {
    for (const level of Object.values(abstract.levels)) {
      if (level.paragraphStyleId !== undefined) styleLevels.set(level.paragraphStyleId, level);
    }
  }

  function findLevel(
    numId: string | undefined,
    index: string,
    work: StyleWork,
  ): NumberingLevel | undefined {
    while (true) {
      work.step();
      if (!nums.has(numId)) return undefined;
      const abstract = abstracts[String(nums.get(numId))];
      if (abstract === undefined) return undefined;
      if (abstract.styleLink === undefined) return abstract.levels[index];
      work.step();
      if (!styleNums.has(abstract.styleLink)) throw new Error("docx_numbering_style_missing");
      numId = styleNums.get(abstract.styleLink);
      // Repeated links consume actual lookup work and fail at the same traversal cap.
    }
  }

  function resolve(node: Element): NumberingLevel | undefined {
    if (node.name !== "w:p") return undefined;
    const work = new StyleWork(limits);
    work.step();
    const properties = first(node, "w:pPr");
    const numProperties = first(properties, "w:numPr");
    const index = first(numProperties, "w:ilvl")?.attributes.get("w:val");
    const numId = first(numProperties, "w:numId")?.attributes.get("w:val");
    if (index !== undefined && numId !== undefined) return findLevel(numId, index, work);
    const styleId = first(properties, "w:pStyle")?.attributes.get("w:val");
    if (styleId !== undefined) {
      work.step();
      const level = styleLevels.get(styleId);
      if (level !== undefined) return level;
    }
    return numId === undefined ? undefined : findLevel(numId, "0", work);
  }

  return (node) => {
    const level = resolve(node);
    return level === undefined
      ? undefined
      : { isOrdered: level.isOrdered, levelIndex: level.levelIndex };
  };
}
