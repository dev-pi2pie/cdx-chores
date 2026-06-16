import { resolve } from "node:path";

import { readMarkdownPdfProfileFile } from "./parse";
import {
  MARKDOWN_PDF_PRESET_GUIDANCE,
  MARKDOWN_PDF_PRESETS,
  normalizeMarkdownPdfOptions,
  type NormalizedMarkdownPdfOptions,
  type MarkdownPdfPresetDensity,
  type MarkdownPdfPreset,
} from "../validation";
import { DEFAULT_MARKDOWN_PDF_PROFILE } from "./defaults";
import { createMarkdownPdfProfileConfig } from "./materialize";
import { normalizeMarkdownPdfProfile } from "./normalize";
import type { NormalizedMarkdownPdfProfileIdentity } from "./types";

export type MarkdownPdfProfileCandidateKind = "default" | "preset" | "base-profile";

export interface MarkdownPdfProfileCandidateTraits {
  cover: boolean;
  toc: boolean;
  pageNumbers: boolean;
  codeHighlight: boolean;
  lineNumbers: boolean;
  density: MarkdownPdfPresetDensity;
  bestFor: string[];
}

export interface MarkdownPdfProfileCandidateSummary {
  id: string;
  kind: MarkdownPdfProfileCandidateKind;
  label: string;
  presetBacked: boolean;
  preset?: MarkdownPdfPreset;
  basedOn?: string;
  fields: string[];
  traits: MarkdownPdfProfileCandidateTraits;
}

export interface MarkdownPdfProfileCandidate {
  summary: MarkdownPdfProfileCandidateSummary;
  fullProfile: Record<string, unknown>;
  identity?: NormalizedMarkdownPdfProfileIdentity;
  path?: string;
}

interface MarkdownPdfProfileCandidateTraitGuidance {
  density?: MarkdownPdfPresetDensity;
  bestFor: string[];
}

export interface LoadMarkdownPdfBaseProfileCandidateInput {
  path: string;
  cwd?: string;
}

function topLevelFields(profile: Record<string, unknown>): string[] {
  return Object.keys(profile)
    .filter((key) => key !== "profile")
    .sort();
}

function cloneProfile(profile: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(profile) as Record<string, unknown>;
}

function lengthToMillimeters(value: string | undefined): number | undefined {
  const match = /^([0-9]+(?:\.[0-9]+)?)(in|mm)$/.exec(value?.trim() ?? "");
  if (!match) {
    return undefined;
  }
  const amount = Number.parseFloat(match[1] ?? "");
  if (!Number.isFinite(amount)) {
    return undefined;
  }
  return match[2] === "in" ? amount * 25.4 : amount;
}

function derivedDensity(options: NormalizedMarkdownPdfOptions): MarkdownPdfPresetDensity {
  if (options.orientation === "landscape") {
    return "wide";
  }
  const margins = Object.values(options.margins).map(lengthToMillimeters);
  if (margins.every((margin) => margin !== undefined && margin <= 12)) {
    return "compact";
  }
  if (margins.every((margin) => margin !== undefined && margin >= 20)) {
    return "spacious";
  }
  return "standard";
}

function createCandidateTraits(
  profile: Record<string, unknown>,
  guidance?: MarkdownPdfProfileCandidateTraitGuidance,
): MarkdownPdfProfileCandidateTraits {
  const normalized = normalizeMarkdownPdfProfile({ profile });
  return {
    cover: normalized.profile.cover.enabled,
    toc: Boolean(normalized.recipeOptions.toc),
    pageNumbers: normalized.profile.pageNumbers.enabled,
    codeHighlight: normalized.profile.code.highlight,
    lineNumbers: normalized.profile.code.lineNumbers,
    density:
      guidance?.density ?? derivedDensity(normalizeMarkdownPdfOptions(normalized.recipeOptions)),
    bestFor: guidance?.bestFor ?? [
      "basic reusable Markdown PDF defaults",
      "weak or absent signals",
    ],
  };
}

function createDefaultCandidate(): MarkdownPdfProfileCandidate {
  const fullProfile = cloneProfile(DEFAULT_MARKDOWN_PDF_PROFILE);
  return {
    summary: {
      id: "default",
      kind: "default",
      label: "Default renderer profile",
      presetBacked: false,
      fields: topLevelFields(fullProfile),
      traits: createCandidateTraits(fullProfile),
    },
    fullProfile,
  };
}

function createPresetCandidate(preset: MarkdownPdfPreset): MarkdownPdfProfileCandidate {
  const fullProfile = cloneProfile(
    createMarkdownPdfProfileConfig(normalizeMarkdownPdfOptions({ preset })),
  );
  return {
    summary: {
      id: preset,
      kind: "preset",
      label: `${preset} preset profile`,
      presetBacked: true,
      preset,
      basedOn: preset,
      fields: topLevelFields(fullProfile),
      traits: createCandidateTraits(fullProfile, MARKDOWN_PDF_PRESET_GUIDANCE[preset]),
    },
    fullProfile,
  };
}

export function createMarkdownPdfProfileCandidates(): MarkdownPdfProfileCandidate[] {
  return [createDefaultCandidate(), ...MARKDOWN_PDF_PRESETS.map(createPresetCandidate)];
}

export async function loadMarkdownPdfBaseProfileCandidate(
  input: LoadMarkdownPdfBaseProfileCandidateInput,
): Promise<MarkdownPdfProfileCandidate> {
  const path = resolve(input.cwd ?? process.cwd(), input.path);
  const fullProfile = cloneProfile(await readMarkdownPdfProfileFile(path));
  const normalized = normalizeMarkdownPdfProfile({ profile: fullProfile });
  const identity = normalized.profile.identity;
  const basedOn = identity?.id ?? identity?.basedOn ?? "untracked-base-profile";

  return {
    summary: {
      id: "base-profile",
      kind: "base-profile",
      label: "User supplied base profile",
      presetBacked: Boolean(identity?.preset),
      preset: identity?.preset,
      basedOn,
      fields: topLevelFields(fullProfile),
      traits: createCandidateTraits(fullProfile, { bestFor: ["user supplied base profile"] }),
    },
    fullProfile,
    identity,
    path,
  };
}
