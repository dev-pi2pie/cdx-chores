import {
  checkFontCoverage,
  NERD_FONT_SAMPLE_TEXT,
  sampleTextForLanguage,
  type CheckFontCoverageInput,
  type FontCoverage,
  type FontCoverageInventory,
} from "../../../fonts";
import type { NormalizedMarkdownPdfProfile } from "./types";

export interface MarkdownPdfProfileFontCoverageWarning {
  role: "body" | "code";
  language?: string;
  family: string;
  message: string;
  coverage: FontCoverage;
}

export interface CheckMarkdownPdfProfileFontCoverageInput {
  profile: NormalizedMarkdownPdfProfile;
  inventories?: FontCoverageInventory[];
  checker?: (input: CheckFontCoverageInput) => FontCoverage;
  warnOnUnknown?: boolean;
}

export interface CheckMarkdownPdfProfileFontCoverageResult {
  results: MarkdownPdfProfileFontCoverageResult[];
  warnings: MarkdownPdfProfileFontCoverageWarning[];
}

export interface MarkdownPdfProfileFontCoverageResult {
  role: "body" | "code";
  language?: string;
  family: string;
  coverage: FontCoverage;
}

function inventoryForFamily(
  inventories: FontCoverageInventory[] | undefined,
  family: string,
): FontCoverageInventory | undefined {
  const familyKey = family.trim().toLowerCase();
  return inventories?.find((inventory) => inventory.family.trim().toLowerCase() === familyKey);
}

function uniqueLanguages(profile: NormalizedMarkdownPdfProfile): string[] {
  const fontLanguages = Object.keys(profile.fonts.body).filter((key) => key !== "default");
  return Array.from(new Set([...profile.contentLangs, ...fontLanguages]));
}

function shouldWarn(coverage: FontCoverage, warnOnUnknown: boolean | undefined): boolean {
  if (coverage.status === "unknown") {
    return warnOnUnknown === true;
  }
  return !coverage.supportsText;
}

export function checkMarkdownPdfProfileFontCoverage(
  input: CheckMarkdownPdfProfileFontCoverageInput,
): CheckMarkdownPdfProfileFontCoverageResult {
  const checker = input.checker ?? checkFontCoverage;
  const results: MarkdownPdfProfileFontCoverageResult[] = [];
  const warnings: MarkdownPdfProfileFontCoverageWarning[] = [];

  for (const language of uniqueLanguages(input.profile)) {
    const family = input.profile.fonts.body[language];
    const sampleText = sampleTextForLanguage(language);
    if (!family || !sampleText) {
      continue;
    }

    const coverage = checker({
      family,
      text: sampleText,
      inventory: inventoryForFamily(input.inventories, family),
    });
    results.push({
      role: "body",
      language,
      family,
      coverage,
    });

    if (shouldWarn(coverage, input.warnOnUnknown)) {
      warnings.push({
        role: "body",
        language,
        family,
        coverage,
        message: `selected body font may not cover ${language} text: ${family} missing ${coverage.missingCodepoints.join(", ")}`,
      });
    }
  }

  const symbolFamily = input.profile.fonts.code.symbols;
  if (symbolFamily) {
    const coverage = checker({
      family: symbolFamily,
      text: NERD_FONT_SAMPLE_TEXT,
      inventory: inventoryForFamily(input.inventories, symbolFamily),
      requireNerdFont: true,
    });
    results.push({
      role: "code",
      family: symbolFamily,
      coverage,
    });

    if (shouldWarn(coverage, input.warnOnUnknown)) {
      warnings.push({
        role: "code",
        family: symbolFamily,
        coverage,
        message: `selected code font does not appear to support Nerd Font glyphs: ${coverage.missingCodepoints.join(", ")}`,
      });
    }
  }

  return { results, warnings };
}
