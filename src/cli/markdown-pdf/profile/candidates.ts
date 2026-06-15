import { resolve } from "node:path";

import { readMarkdownPdfProfileFile } from "./parse";
import {
  MARKDOWN_PDF_PRESETS,
  normalizeMarkdownPdfOptions,
  type MarkdownPdfPreset,
} from "../validation";
import { DEFAULT_MARKDOWN_PDF_PROFILE } from "./defaults";
import { createMarkdownPdfProfileConfig } from "./materialize";
import { normalizeMarkdownPdfProfile } from "./normalize";
import type { NormalizedMarkdownPdfProfileIdentity } from "./types";

export type MarkdownPdfProfileCandidateKind = "default" | "preset" | "base-profile";
export type MarkdownPdfProfileCandidateDensity = "compact" | "standard" | "spacious" | "wide";

export interface MarkdownPdfProfileCandidateTraits {
  cover: boolean;
  toc: boolean;
  pageNumbers: boolean;
  codeHighlight: boolean;
  lineNumbers: boolean;
  density: MarkdownPdfProfileCandidateDensity;
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

const PRESET_TRAITS: Record<
  MarkdownPdfPreset,
  Pick<MarkdownPdfProfileCandidateTraits, "bestFor" | "density">
> = {
  article: {
    bestFor: ["general documents", "README-like technical docs", "short structured writing"],
    density: "standard",
  },
  report: {
    bestFor: ["formal reports", "specifications", "long-form documents"],
    density: "standard",
  },
  "wide-table": {
    bestFor: ["wide tables", "landscape reports", "dense tabular documents"],
    density: "wide",
  },
  compact: {
    bestFor: ["space-constrained output", "dense notes", "short handouts"],
    density: "compact",
  },
  reader: {
    bestFor: ["long reading documents", "narrative docs", "review copies"],
    density: "spacious",
  },
};

function createCandidateTraits(
  profile: Record<string, unknown>,
  preset?: MarkdownPdfPreset,
): MarkdownPdfProfileCandidateTraits {
  const normalized = normalizeMarkdownPdfProfile({ profile });
  const presetTraits = preset
    ? PRESET_TRAITS[preset]
    : {
        bestFor: ["basic reusable Markdown PDF defaults", "weak or absent signals"],
        density: "standard" as const,
      };
  return {
    cover: normalized.profile.cover.enabled,
    toc: Boolean(normalized.recipeOptions.toc),
    pageNumbers: normalized.profile.pageNumbers.enabled,
    codeHighlight: normalized.profile.code.highlight,
    lineNumbers: normalized.profile.code.lineNumbers,
    density: presetTraits.density,
    bestFor: presetTraits.bestFor,
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
      traits: createCandidateTraits(fullProfile, preset),
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
      traits: createCandidateTraits(fullProfile, identity?.preset),
    },
    fullProfile,
    identity,
    path,
  };
}
