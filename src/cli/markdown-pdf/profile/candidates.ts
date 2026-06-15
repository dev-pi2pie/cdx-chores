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

export interface MarkdownPdfProfileCandidateSummary {
  id: string;
  kind: MarkdownPdfProfileCandidateKind;
  label: string;
  presetBacked: boolean;
  preset?: MarkdownPdfPreset;
  basedOn?: string;
  fields: string[];
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

function createDefaultCandidate(): MarkdownPdfProfileCandidate {
  const fullProfile = { ...DEFAULT_MARKDOWN_PDF_PROFILE };
  return {
    summary: {
      id: "default",
      kind: "default",
      label: "Default renderer profile",
      presetBacked: false,
      fields: topLevelFields(fullProfile),
    },
    fullProfile,
  };
}

function createPresetCandidate(preset: MarkdownPdfPreset): MarkdownPdfProfileCandidate {
  const fullProfile = createMarkdownPdfProfileConfig(normalizeMarkdownPdfOptions({ preset }));
  return {
    summary: {
      id: preset,
      kind: "preset",
      label: `${preset} preset profile`,
      presetBacked: true,
      preset,
      basedOn: preset,
      fields: topLevelFields(fullProfile),
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
  const fullProfile = await readMarkdownPdfProfileFile(path);
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
    },
    fullProfile,
    identity,
    path,
  };
}
