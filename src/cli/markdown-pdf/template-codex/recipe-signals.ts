import { definedRecipeOptions } from "../../actions/markdown/common";
import { buildMarkdownPdfTableLayoutSignal } from "../profile/layout-policy";
import type { MarkdownPdfDocumentSignals } from "../profile/signals";
import { normalizeMarkdownPdfOptions } from "../validation";
import type { NormalizeMarkdownPdfOptionsInput } from "../validation";
import type {
  MdPdfTemplateCodexExplicitRecipeSignal,
  MdPdfTemplateCodexOptions,
  MarkdownPdfTemplateCodexLayoutPolicySignal,
  MarkdownPdfTemplateCodexRecipeSignals,
} from "./types";

const PAGE_LAYOUT_RECIPE_FIELDS = new Set([
  "preset",
  "pageSize",
  "orientation",
  "margin",
  "marginX",
  "marginY",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
]);

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
  documentSignals: MarkdownPdfDocumentSignals;
  explicitRecipe: MdPdfTemplateCodexExplicitRecipeSignal;
}): MarkdownPdfTemplateCodexRecipeSignals {
  const baseProfileRecipeOptions = definedRecipeOptions(input.baseProfileRecipeOptions ?? {});
  const explicitFields = input.explicitRecipe.fields;
  const baseProfileFields = Object.keys(baseProfileRecipeOptions).sort();
  const baseOptions = normalizeMarkdownPdfOptions({
    ...baseProfileRecipeOptions,
    ...input.explicitRecipe.options,
  });
  const layoutPolicy = resolveTemplateCodexLayoutPolicy({
    baseProfileFields,
    documentSignals: input.documentSignals,
    explicitFields,
  });
  const effectiveOptions =
    layoutPolicy.recipePreset.status === "applied" && layoutPolicy.recipePreset.preset
      ? normalizeMarkdownPdfOptions({
          preset: layoutPolicy.recipePreset.preset,
          toc: baseOptions.toc,
          tocDepth: baseOptions.tocDepth,
          tocPageBreak: baseOptions.tocPageBreak,
          allowRemoteAssets: baseOptions.allowRemoteAssets,
        })
      : baseOptions;

  return {
    effectiveOptions,
    explicitFields,
    baseProfileFields,
    layoutPolicy,
  };
}

function pageLayoutOwner(input: {
  baseProfileFields: readonly string[];
  explicitFields: readonly string[];
}): "explicit-recipe" | "base-profile" | undefined {
  if (input.explicitFields.some((field) => PAGE_LAYOUT_RECIPE_FIELDS.has(field))) {
    return "explicit-recipe";
  }
  if (input.baseProfileFields.some((field) => PAGE_LAYOUT_RECIPE_FIELDS.has(field))) {
    return "base-profile";
  }
  return undefined;
}

function resolveTemplateCodexLayoutPolicy(input: {
  baseProfileFields: readonly string[];
  documentSignals: MarkdownPdfDocumentSignals;
  explicitFields: readonly string[];
}): MarkdownPdfTemplateCodexLayoutPolicySignal {
  const tableLayoutSignal = buildMarkdownPdfTableLayoutSignal(input.documentSignals.tables);
  const owner = pageLayoutOwner(input);

  if (tableLayoutSignal.level !== "strong") {
    return {
      tableLayoutSignal,
      recipePreset: {
        status: "not-needed",
        source: "document-table-signal",
        reason:
          tableLayoutSignal.level === "weak"
            ? "weak table layout signal affects table styling only"
            : "no table layout signal",
      },
    };
  }

  if (owner) {
    return {
      tableLayoutSignal,
      recipePreset: {
        status: "blocked",
        source: "document-table-signal",
        preset: "wide-table",
        blockedBy: owner,
        reason: `strong table layout signal blocked by ${owner} page recipe ownership`,
      },
    };
  }

  return {
    tableLayoutSignal,
    recipePreset: {
      status: "applied",
      source: "document-table-signal",
      preset: "wide-table",
      reason: "strong table layout signal derived wide-table recipe",
    },
  };
}
