import { readTextFileRequired } from "../../file-io";
import type { CliRuntime } from "../../types";
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
import { collectTemplateCodexCoverImageSignals } from "../template-codex/cover-assets";
import { collectMdPdfTemplateCodexRecipeSignals } from "../template-codex/recipe-signals";
import {
  classifyMdPdfProjectCodexSignalModes,
  collectTemplateOwnedProjectDirections,
} from "./signal-mode";
import type {
  MdPdfProjectCodexSignalCollection,
  NormalizedMdPdfProjectCodexCommandState,
} from "./types";

export async function collectMdPdfProjectCodexSignals(
  runtime: CliRuntime,
  state: NormalizedMdPdfProjectCodexCommandState,
): Promise<MdPdfProjectCodexSignalCollection> {
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
    explicitRecipe: {
      fields: [],
      options: {},
    },
  });
  const coverImage = await collectTemplateCodexCoverImageSignals(state.coverImagePath);
  const templateOwnedSignals = collectTemplateOwnedProjectDirections({
    intent: state.intent,
    recipe,
  });
  const signalFacts = {
    hasBaseProfile: Boolean(baseProfileCandidate),
    hasFontHints: state.fontHints.length > 0,
    hasInput: Boolean(state.inputPath),
    hasIntent: Boolean(state.intent),
    hasCoverImage: coverImage.available,
    templateOwnedSignals,
  };
  const { profileSignalMode, signalMode, templateSignalMode } =
    classifyMdPdfProjectCodexSignalModes(signalFacts);

  return {
    signalMode,
    profileSignalMode,
    templateSignalMode,
    documentSignals,
    baseProfile: {
      available: Boolean(baseProfileCandidate),
      candidate: baseProfileCandidate,
    },
    profileBasis: {
      candidate: selectedProfile,
      normalizedProfile: normalizedSelectedProfile.profile,
      source: baseProfileCandidate ? "base-profile" : "default-profile",
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
    templateOwnedSignals,
  };
}
