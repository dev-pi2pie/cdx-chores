import { definedRecipeOptions } from "../../actions/markdown/common";
import { normalizeMarkdownPdfOptions } from "../validation";
import type { NormalizeMarkdownPdfOptionsInput } from "../validation";
import type {
  MdPdfTemplateCodexExplicitRecipeSignal,
  MdPdfTemplateCodexOptions,
  MarkdownPdfTemplateCodexRecipeSignals,
} from "./types";

export function collectMdPdfTemplateCodexExplicitRecipeSignal(
  options: MdPdfTemplateCodexOptions,
): MdPdfTemplateCodexExplicitRecipeSignal {
  const explicitOptions = definedRecipeOptions({
    preset: options.preset,
    pageSize: options.pageSize,
    orientation: options.orientation,
    margin: options.margin,
    marginX: options.marginX,
    marginY: options.marginY,
    marginTop: options.marginTop,
    marginRight: options.marginRight,
    marginBottom: options.marginBottom,
    marginLeft: options.marginLeft,
    toc: options.toc,
    tocDepth: options.tocDepth,
    tocPageBreak: options.tocPageBreak,
  });
  return {
    options: explicitOptions,
    fields: Object.keys(explicitOptions).sort(),
  };
}

export function collectMdPdfTemplateCodexRecipeSignals(input: {
  baseProfileRecipeOptions?: NormalizeMarkdownPdfOptionsInput;
  explicitRecipe: MdPdfTemplateCodexExplicitRecipeSignal;
}): MarkdownPdfTemplateCodexRecipeSignals {
  const baseProfileRecipeOptions = definedRecipeOptions(input.baseProfileRecipeOptions ?? {});
  return {
    effectiveOptions: normalizeMarkdownPdfOptions({
      ...baseProfileRecipeOptions,
      ...input.explicitRecipe.options,
    }),
    explicitFields: input.explicitRecipe.fields,
    baseProfileFields: Object.keys(baseProfileRecipeOptions).sort(),
  };
}
