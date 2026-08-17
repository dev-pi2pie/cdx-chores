import { readTextFileRequired } from "../../file-io";
import {
  createMarkdownPdfProfileCandidates,
  loadMarkdownPdfBaseProfileCandidate,
  type MarkdownPdfProfileCandidateSummary,
} from "../profile/candidates";
import { normalizeMarkdownPdfProfile, type NormalizedMarkdownPdfProfile } from "../profile";
import {
  collectMarkdownPdfDocumentSignals,
  collectMarkdownPdfFontSignals,
  createAbsentMarkdownPdfDocumentSignals,
  type MarkdownPdfFontSignals,
} from "../profile/signals";
import {
  hasExplicitHideMetadataTitleIntent,
  hasExplicitKeepMetadataTitleIntent,
} from "../profile/title-intent";
import { collectTemplateCodexCoverImageSignals } from "./cover-assets";
import {
  deriveMdPdfTemplateCodexFontOwnership,
  type MarkdownPdfTemplateCodexFontOwnership,
} from "./font-ownership";
import { collectMdPdfTemplateCodexRecipeSignals } from "./recipe-signals";
import { classifyMdPdfTemplateCodexSignalMode } from "./signal-mode";
import type { CliRuntime } from "../../types";
import type {
  MdPdfTemplateCodexSignalCollection,
  MarkdownPdfTemplateCodexBaseProfileSummary,
  NormalizedMdPdfTemplateCodexCommandState,
} from "./types";

interface MdPdfTemplateCodexSignalContext {
  compatibilityProfile?: NormalizedMarkdownPdfProfile;
  fontOwnership?: MarkdownPdfTemplateCodexFontOwnership;
  signals: MdPdfTemplateCodexSignalCollection;
}

export function createMdPdfTemplateCodexBaseProfileSummary(
  summary: MarkdownPdfProfileCandidateSummary,
): MarkdownPdfTemplateCodexBaseProfileSummary {
  return {
    id: summary.id,
    kind: summary.kind,
    label: summary.label,
    presetBacked: summary.presetBacked,
    ...(summary.preset ? { preset: summary.preset } : {}),
    ...(summary.basedOn ? { basedOn: summary.basedOn } : {}),
    fields: summary.fields.filter((field) => field !== "pageNumbers"),
    traits: {
      cover: summary.traits.cover,
      toc: summary.traits.toc,
      codeHighlight: summary.traits.codeHighlight,
      lineNumbers: summary.traits.lineNumbers,
      density: summary.traits.density,
      bestFor: summary.traits.bestFor,
    },
  };
}

export function collectMdPdfTemplateCodexFontSignals(
  profile: NormalizedMarkdownPdfProfile,
): MarkdownPdfFontSignals {
  return collectMarkdownPdfFontSignals({
    profile: {
      ...profile,
      fonts: {
        ...profile.fonts,
        pageChrome: {},
      },
    },
  });
}

export async function collectMdPdfTemplateCodexSignalContext(
  runtime: CliRuntime,
  state: NormalizedMdPdfTemplateCodexCommandState,
): Promise<MdPdfTemplateCodexSignalContext> {
  const markdown = state.inputPath ? await readTextFileRequired(state.inputPath) : undefined;
  const baseProfileCandidate = state.baseProfilePath
    ? await loadMarkdownPdfBaseProfileCandidate({
        cwd: runtime.cwd,
        path: state.baseProfilePath,
      })
    : undefined;
  const fallbackProfileCandidate = createMarkdownPdfProfileCandidates()[0];
  if (!baseProfileCandidate && !fallbackProfileCandidate) {
    throw new Error("No Markdown PDF profile candidates are available.");
  }

  const normalizedBaseProfile = baseProfileCandidate
    ? normalizeMarkdownPdfProfile({ profile: baseProfileCandidate.fullProfile })
    : undefined;
  const normalizedSelectedProfile =
    normalizedBaseProfile ??
    normalizeMarkdownPdfProfile({
      profile: fallbackProfileCandidate!.fullProfile,
    });
  const documentSignals = markdown
    ? collectMarkdownPdfDocumentSignals(markdown)
    : createAbsentMarkdownPdfDocumentSignals();
  const recipe = collectMdPdfTemplateCodexRecipeSignals({
    baseProfileRecipeOptions: normalizedBaseProfile?.recipeOptions,
    documentSignals,
    explicitRecipe: state.explicitRecipe,
  });
  const coverImage = await collectTemplateCodexCoverImageSignals(state.coverImagePath);
  const signalMode = classifyMdPdfTemplateCodexSignalMode({
    hasBaseProfile: Boolean(baseProfileCandidate),
    hasCoverImage: coverImage.available,
    hasFontHints: state.fontHints.length > 0,
    hasInput: Boolean(state.inputPath),
    hasIntent: Boolean(state.intent),
    hasRecipeFlags: state.explicitRecipe.fields.length > 0,
    hasUsableTemplateCandidate: true,
  });

  return {
    ...(normalizedBaseProfile ? { compatibilityProfile: normalizedBaseProfile.profile } : {}),
    ...(normalizedBaseProfile
      ? {
          fontOwnership: deriveMdPdfTemplateCodexFontOwnership(normalizedBaseProfile.profile),
        }
      : {}),
    signals: {
      signalMode,
      documentSignals,
      baseProfile: {
        available: Boolean(baseProfileCandidate),
        ...(baseProfileCandidate
          ? { summary: createMdPdfTemplateCodexBaseProfileSummary(baseProfileCandidate.summary) }
          : {}),
      },
      recipe,
      title: {
        ...(baseProfileCandidate
          ? {
              baseProfileMetadataTitle: normalizedSelectedProfile.profile.titleBlock.metadataTitle,
            }
          : {}),
        explicitKeepMetadataTitleIntent: hasExplicitKeepMetadataTitleIntent(state.intent ?? ""),
        explicitHideMetadataTitleIntent: hasExplicitHideMetadataTitleIntent(state.intent ?? ""),
      },
      fonts: {
        hints: state.fontHints,
        profileFonts: collectMdPdfTemplateCodexFontSignals(normalizedSelectedProfile.profile),
      },
      coverImage,
    },
  };
}

export async function collectMdPdfTemplateCodexSignals(
  runtime: CliRuntime,
  state: NormalizedMdPdfTemplateCodexCommandState,
): Promise<MdPdfTemplateCodexSignalCollection> {
  return (await collectMdPdfTemplateCodexSignalContext(runtime, state)).signals;
}
