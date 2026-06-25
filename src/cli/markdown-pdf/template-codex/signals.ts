import { readTextFileRequired } from "../../file-io";
import {
  createMarkdownPdfProfileCandidates,
  loadMarkdownPdfBaseProfileCandidate,
} from "../profile/candidates";
import { normalizeMarkdownPdfProfile } from "../profile";
import {
  collectMarkdownPdfDocumentSignals,
  collectMarkdownPdfFontSignals,
  createAbsentMarkdownPdfDocumentSignals,
} from "../profile/signals";
import {
  hasExplicitHideMetadataTitleIntent,
  hasExplicitKeepMetadataTitleIntent,
} from "../profile/title-intent";
import { collectTemplateCodexCoverImageSignals } from "./cover-assets";
import { collectMdPdfTemplateCodexRecipeSignals } from "./recipe-signals";
import { classifyMdPdfTemplateCodexSignalMode } from "./signal-mode";
import type { CliRuntime } from "../../types";
import type {
  MdPdfTemplateCodexSignalCollection,
  NormalizedMdPdfTemplateCodexCommandState,
} from "./types";

export async function collectMdPdfTemplateCodexSignals(
  runtime: CliRuntime,
  state: NormalizedMdPdfTemplateCodexCommandState,
): Promise<MdPdfTemplateCodexSignalCollection> {
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

  const selectedProfile = baseProfileCandidate ?? fallbackProfileCandidate!;
  const normalizedSelectedProfile = normalizeMarkdownPdfProfile({
    profile: selectedProfile.fullProfile,
  });
  const documentSignals = markdown
    ? collectMarkdownPdfDocumentSignals(markdown)
    : createAbsentMarkdownPdfDocumentSignals();
  const recipe = collectMdPdfTemplateCodexRecipeSignals({
    baseProfileRecipeOptions: baseProfileCandidate
      ? normalizeMarkdownPdfProfile({ profile: baseProfileCandidate.fullProfile }).recipeOptions
      : undefined,
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
    signalMode,
    documentSignals,
    baseProfile: {
      available: Boolean(baseProfileCandidate),
      summary: baseProfileCandidate?.summary,
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
      profileFonts: collectMarkdownPdfFontSignals({
        profile: normalizedSelectedProfile.profile,
      }),
    },
    coverImage,
  };
}
