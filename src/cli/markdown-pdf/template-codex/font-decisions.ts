import { validateMarkdownPdfBodyFontKey } from "../profile/schema";
import { canonicalizeMdPdfTemplateFontKey } from "./font-keys";
import type {
  MarkdownPdfTemplateCodexFontRole,
  MarkdownPdfTemplateCodexTemplateFontDecision,
  MarkdownPdfTemplateCodexTemplateFontDecisionSource,
  MdPdfTemplateCodexSignalCollection,
} from "./types";

interface MarkdownPdfTemplateCodexFontDecisionDomains {
  roles: readonly MarkdownPdfTemplateCodexFontRole[];
  sources: readonly MarkdownPdfTemplateCodexTemplateFontDecisionSource[];
}

function assertStringInDomain<T extends string>(
  value: string,
  accepted: readonly T[],
  context: string,
): T {
  if ((accepted as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new Error(
    `Markdown PDF template Codex response ${context} must be one of: ${accepted.join(", ")}.`,
  );
}

function assertNonEmptyString(value: string, context: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`Markdown PDF template Codex response ${context} must not be empty.`);
  }
  return trimmed;
}

function assertBoolean(value: boolean, context: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Markdown PDF template Codex response ${context} must be a boolean.`);
  }
  return value;
}

function validateTemplateFontFamily(value: string, context: string): string {
  const family = assertNonEmptyString(value, context);
  if (/[;{}(),\r\n]/u.test(family)) {
    throw new Error(
      `Markdown PDF template Codex response ${context} must be a single font family name, not raw CSS.`,
    );
  }
  return family;
}

function validateTemplateFontKey(input: {
  context: string;
  key: string;
  role: MarkdownPdfTemplateCodexTemplateFontDecision["role"];
}): string {
  const key = assertNonEmptyString(input.key, `${input.context}.key`);
  if (input.role === "body") {
    try {
      validateMarkdownPdfBodyFontKey(key);
    } catch {
      throw new Error(
        `Markdown PDF template Codex response ${input.context}.key must be default or a valid language tag for body fonts.`,
      );
    }
    return key;
  }
  if (input.role === "code" && (key === "default" || key === "symbols")) {
    return key;
  }
  if (input.role === "heading" && key === "default") {
    return key;
  }
  if (input.role === "code") {
    throw new Error(
      `Markdown PDF template Codex response ${input.context}.key must be default or symbols for code fonts.`,
    );
  }
  throw new Error(
    `Markdown PDF template Codex response ${input.context}.key must be default for ${input.role} fonts.`,
  );
}

export function validateMarkdownPdfTemplateCodexFontDecisions(input: {
  decisions: readonly MarkdownPdfTemplateCodexTemplateFontDecision[];
  domains: MarkdownPdfTemplateCodexFontDecisionDomains;
}): MarkdownPdfTemplateCodexTemplateFontDecision[] {
  const seenRoleKeys = new Set<string>();
  return input.decisions.map((decision, index) => {
    const context = `font_decisions[${index}]`;
    const role = assertStringInDomain(decision.role, input.domains.roles, `${context}.role`);
    const key = validateTemplateFontKey({
      context,
      key: decision.key,
      role,
    });
    const canonicalKey = canonicalizeMdPdfTemplateFontKey(role, key);
    const roleKey = `${role}.${canonicalKey}`;
    if (seenRoleKeys.has(roleKey)) {
      throw new Error(
        `Markdown PDF template Codex response ${context}.key duplicates font role/key ${roleKey}.`,
      );
    }
    seenRoleKeys.add(roleKey);
    const source = assertStringInDomain(
      decision.source,
      input.domains.sources,
      `${context}.source`,
    );
    const templateLevel = assertBoolean(decision.templateLevel, `${context}.template_level`);
    if (templateLevel && source !== "template-style") {
      throw new Error(
        `Markdown PDF template Codex response ${context}.template_level requires source template-style.`,
      );
    }
    return {
      role,
      key: canonicalKey,
      family: validateTemplateFontFamily(decision.family, `${context}.family`),
      source,
      templateLevel,
    };
  });
}

function fontRoleKey(role: MarkdownPdfTemplateCodexFontRole, key: string): string {
  return `${role}.${canonicalizeMdPdfTemplateFontKey(role, key)}`;
}

function fontHintTargetForDescription(
  description: string,
): Pick<MarkdownPdfTemplateCodexTemplateFontDecision, "key" | "role"> | undefined {
  const normalized = description.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (/\bsymbols?\b/u.test(normalized)) {
    return { role: "code", key: "symbols" };
  }
  if (/\b(?:code|monospace|mono)\b/u.test(normalized)) {
    return { role: "code", key: "default" };
  }
  if (/\b(?:heading|headings|title|titles)\b/u.test(normalized)) {
    return { role: "heading", key: "default" };
  }
  if (/\b(?:japanese|ja|jp)\b/u.test(normalized)) {
    return { role: "body", key: "ja" };
  }
  if (
    /\b(?:traditional chinese|traditional-chinese|繁體|繁体|zh-hant|zh_hant)\b/u.test(normalized)
  ) {
    return { role: "body", key: "zh-Hant" };
  }
  if (/\b(?:english|en|body|text|serif)\b/u.test(normalized)) {
    return { role: "body", key: "default" };
  }
  return undefined;
}

const FONT_HINT_VERB_PATTERN = "(?:(?:use|using|choose|set|apply)|prefer(?:\\s+using)?)";

function fontHintSegments(hint: string): string[] {
  const multiClauseSeparator = new RegExp(
    `[,;]|\\s+\\band\\s+(?=(?:(?:please\\s+)?${FONT_HINT_VERB_PATTERN}\\s+)?[^,;]+?\\s+for\\s+)`,
    "iu",
  );
  const leadIn = new RegExp(`^(?:and\\s+)?(?:please\\s+)?${FONT_HINT_VERB_PATTERN}\\s+`, "iu");
  return hint
    .split(multiClauseSeparator)
    .map((segment) => segment.trim().replace(leadIn, ""))
    .filter((segment) => segment.length > 0);
}

function templateFontDecisionsFromFontHints(
  hints: readonly string[],
): MarkdownPdfTemplateCodexTemplateFontDecision[] {
  const decisions: MarkdownPdfTemplateCodexTemplateFontDecision[] = [];
  const seen = new Set<string>();
  for (const hint of hints) {
    for (const segment of fontHintSegments(hint)) {
      const match = /^(?<family>.+?)\s+for\s+(?<target>.+)$/iu.exec(segment);
      const family = match?.groups?.family?.trim();
      const target = match?.groups?.target
        ? fontHintTargetForDescription(match.groups.target)
        : undefined;
      if (!family || !target) {
        continue;
      }
      const roleKey = fontRoleKey(target.role, target.key);
      if (seen.has(roleKey)) {
        continue;
      }
      seen.add(roleKey);
      decisions.push({
        family: validateTemplateFontFamily(family, `font hint ${roleKey}`),
        key: canonicalizeMdPdfTemplateFontKey(target.role, target.key),
        role: target.role,
        source: "font-hint",
        templateLevel: false,
      });
    }
  }
  return decisions;
}

export function completeMarkdownPdfTemplateCodexFontHintDecisions(input: {
  decisions: readonly MarkdownPdfTemplateCodexTemplateFontDecision[];
  signals: MdPdfTemplateCodexSignalCollection;
}): MarkdownPdfTemplateCodexTemplateFontDecision[] {
  const completed = [...input.decisions];
  const seen = new Set(completed.map((decision) => fontRoleKey(decision.role, decision.key)));
  for (const decision of templateFontDecisionsFromFontHints(input.signals.fonts.hints)) {
    const roleKey = fontRoleKey(decision.role, decision.key);
    if (seen.has(roleKey)) {
      continue;
    }
    seen.add(roleKey);
    completed.push(decision);
  }
  return completed;
}
