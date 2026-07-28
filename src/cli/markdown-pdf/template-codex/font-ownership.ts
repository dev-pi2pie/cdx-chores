import type { MarkdownPdfFontRole, NormalizedMarkdownPdfProfile } from "../profile";
import { canonicalizeMdPdfTemplateFontKey } from "./font-keys";

export interface MarkdownPdfTemplateCodexOwnedFontKey {
  role: MarkdownPdfFontRole;
  key: string;
}

export interface MarkdownPdfTemplateCodexFontOwnership {
  ownedKeys: readonly MarkdownPdfTemplateCodexOwnedFontKey[];
  slots: {
    bodyDefault: boolean;
    bodyLanguages: readonly string[];
    headingDefault: boolean;
    codeStack: boolean;
    pageChromeDefault: boolean;
  };
}

export const EMPTY_MD_PDF_TEMPLATE_CODEX_FONT_OWNERSHIP: MarkdownPdfTemplateCodexFontOwnership = {
  ownedKeys: [],
  slots: {
    bodyDefault: false,
    bodyLanguages: [],
    headingDefault: false,
    codeStack: false,
    pageChromeDefault: false,
  },
};

const FONT_ROLE_ORDER: readonly MarkdownPdfFontRole[] = ["body", "heading", "code", "pageChrome"];

function canonicalizeProfileFontKey(role: MarkdownPdfFontRole, key: string): string {
  return role === "body" ? canonicalizeMdPdfTemplateFontKey("body", key) : key;
}

function hasConfiguredFamily(family: string): boolean {
  return family.trim().length > 0;
}

export function deriveMdPdfTemplateCodexFontOwnership(
  compatibilityProfile: NormalizedMarkdownPdfProfile | undefined,
): MarkdownPdfTemplateCodexFontOwnership {
  if (!compatibilityProfile) {
    return EMPTY_MD_PDF_TEMPLATE_CODEX_FONT_OWNERSHIP;
  }

  const ownedKeys = FONT_ROLE_ORDER.flatMap((role) =>
    Object.entries(compatibilityProfile.fonts[role])
      .filter(([, family]) => hasConfiguredFamily(family))
      .map(([key]) => ({
        role,
        key: canonicalizeProfileFontKey(role, key),
      })),
  );
  const bodyLanguages = ownedKeys
    .filter((entry) => entry.role === "body" && entry.key !== "default")
    .map((entry) => entry.key);
  const owns = (role: MarkdownPdfFontRole, key: string) =>
    ownedKeys.some((entry) => entry.role === role && entry.key === key);

  return {
    ownedKeys,
    slots: {
      bodyDefault: owns("body", "default"),
      bodyLanguages,
      headingDefault: owns("heading", "default"),
      codeStack: owns("code", "default") || owns("code", "symbols"),
      pageChromeDefault: owns("pageChrome", "default"),
    },
  };
}

export function mdPdfTemplateCodexOwnsFontKey(
  ownership: MarkdownPdfTemplateCodexFontOwnership,
  role: MarkdownPdfFontRole,
  key: string,
): boolean {
  const canonicalKey = canonicalizeProfileFontKey(role, key);
  return ownership.ownedKeys.some((entry) => entry.role === role && entry.key === canonicalKey);
}

export function mdPdfTemplateCodexOwnsFontSlot(
  ownership: MarkdownPdfTemplateCodexFontOwnership,
  role: MarkdownPdfFontRole,
  key: string,
): boolean {
  const canonicalKey = canonicalizeProfileFontKey(role, key);
  if (role === "body") {
    return canonicalKey === "default"
      ? ownership.slots.bodyDefault
      : ownership.slots.bodyLanguages.includes(canonicalKey);
  }
  if (role === "heading" && canonicalKey === "default") {
    return ownership.slots.headingDefault;
  }
  if (role === "code" && (canonicalKey === "default" || canonicalKey === "symbols")) {
    return ownership.slots.codeStack;
  }
  if (role === "pageChrome" && canonicalKey === "default") {
    return ownership.slots.pageChromeDefault;
  }
  return mdPdfTemplateCodexOwnsFontKey(ownership, role, canonicalKey);
}
