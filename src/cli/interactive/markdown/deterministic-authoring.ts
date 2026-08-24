import {
  normalizeMarkdownPdfOptions,
  type NormalizeMarkdownPdfOptionsInput,
} from "../../markdown-pdf";
import {
  bindPreparedMarkdownPdfProfileInitDestination,
  prepareMarkdownPdfProfileInit,
  writePreparedMarkdownPdfProfileInit,
  type BoundMarkdownPdfProfileInitDestination,
  type PreparedMarkdownPdfProfileInit,
} from "../../markdown-pdf/profile/init-service";
import {
  bindPreparedMarkdownPdfTemplateInitDestination,
  prepareMarkdownPdfTemplateInit,
  writePreparedMarkdownPdfTemplateInit,
  type BoundMarkdownPdfTemplateInitDestination,
  type PreparedMarkdownPdfTemplateInit,
} from "../../markdown-pdf/template/init-service";
import type { CliRuntime } from "../../types";

import {
  compileMarkdownPdfFormalGuideProfile,
  type MarkdownPdfFormalGuideAnswers,
  type MarkdownPdfProfileFormalGuideAnswers,
} from "./formal-guide";

export type MarkdownPdfDeterministicArtifact = "profile" | "template-bundle";
export type MarkdownPdfDeterministicPreparation = "starter" | "formal-guide";

interface PreparedMarkdownPdfDeterministicRecipeBase {
  artifact: MarkdownPdfDeterministicArtifact;
  preparation: MarkdownPdfDeterministicPreparation;
}

export interface PreparedMarkdownPdfDeterministicProfile extends PreparedMarkdownPdfDeterministicRecipeBase {
  artifact: "profile";
  formalGuideAnswers?: MarkdownPdfProfileFormalGuideAnswers;
  prepared: PreparedMarkdownPdfProfileInit;
}

export interface PreparedMarkdownPdfDeterministicTemplate extends PreparedMarkdownPdfDeterministicRecipeBase {
  artifact: "template-bundle";
  formalGuideAnswers?: MarkdownPdfFormalGuideAnswers;
  prepared: PreparedMarkdownPdfTemplateInit;
}

export type PreparedMarkdownPdfDeterministicRecipe =
  | PreparedMarkdownPdfDeterministicProfile
  | PreparedMarkdownPdfDeterministicTemplate;

export type BoundMarkdownPdfDeterministicRecipe =
  | {
      artifact: "profile";
      candidate: PreparedMarkdownPdfDeterministicProfile;
      destination: BoundMarkdownPdfProfileInitDestination;
    }
  | {
      artifact: "template-bundle";
      candidate: PreparedMarkdownPdfDeterministicTemplate;
      destination: BoundMarkdownPdfTemplateInitDestination;
    };

type PrepareMarkdownPdfDeterministicRecipeInput =
  | {
      artifact: "profile";
      formalGuideAnswers?: MarkdownPdfProfileFormalGuideAnswers;
      options?: NormalizeMarkdownPdfOptionsInput;
      preparation: MarkdownPdfDeterministicPreparation;
    }
  | {
      artifact: "template-bundle";
      formalGuideAnswers?: MarkdownPdfFormalGuideAnswers;
      options?: NormalizeMarkdownPdfOptionsInput;
      preparation: MarkdownPdfDeterministicPreparation;
    };

export function prepareMarkdownPdfDeterministicRecipe(
  input: PrepareMarkdownPdfDeterministicRecipeInput,
): PreparedMarkdownPdfDeterministicRecipe {
  const normalizedOptions = normalizeMarkdownPdfOptions(input.options);
  if (input.artifact === "profile") {
    return {
      artifact: "profile",
      preparation: input.preparation,
      ...(input.formalGuideAnswers ? { formalGuideAnswers: input.formalGuideAnswers } : {}),
      prepared: prepareMarkdownPdfProfileInit(
        normalizedOptions,
        input.formalGuideAnswers
          ? compileMarkdownPdfFormalGuideProfile(input.formalGuideAnswers)
          : undefined,
      ),
    };
  }
  return {
    artifact: "template-bundle",
    preparation: input.preparation,
    ...(input.formalGuideAnswers ? { formalGuideAnswers: input.formalGuideAnswers } : {}),
    prepared: prepareMarkdownPdfTemplateInit(normalizedOptions),
  };
}

export async function bindMarkdownPdfDeterministicRecipeDestination(
  runtime: CliRuntime,
  candidate: PreparedMarkdownPdfDeterministicRecipe,
  input: { output: string; overwrite?: boolean },
): Promise<BoundMarkdownPdfDeterministicRecipe> {
  if (candidate.artifact === "profile") {
    return {
      artifact: "profile",
      candidate,
      destination: bindPreparedMarkdownPdfProfileInitDestination(
        runtime,
        candidate.prepared,
        input,
      ),
    };
  }
  return {
    artifact: "template-bundle",
    candidate,
    destination: await bindPreparedMarkdownPdfTemplateInitDestination(
      runtime,
      candidate.prepared,
      input,
    ),
  };
}

export async function writeBoundMarkdownPdfDeterministicRecipe(
  bound: BoundMarkdownPdfDeterministicRecipe,
): Promise<void> {
  if (bound.artifact === "profile") {
    await writePreparedMarkdownPdfProfileInit(bound.destination);
    return;
  }
  await writePreparedMarkdownPdfTemplateInit(bound.destination);
}

export function markdownPdfDeterministicOutputPath(
  bound: BoundMarkdownPdfDeterministicRecipe,
): string {
  return bound.artifact === "profile"
    ? bound.destination.displayOutputPath
    : bound.destination.displayOutputDirectory;
}

export function markdownPdfDeterministicDestinationPath(
  bound: BoundMarkdownPdfDeterministicRecipe,
): string {
  return bound.artifact === "profile"
    ? bound.destination.outputPath
    : bound.destination.outputDirectory;
}

export function markdownPdfDeterministicOutputFiles(
  bound: BoundMarkdownPdfDeterministicRecipe,
): string[] {
  return bound.artifact === "profile"
    ? [bound.destination.outputPath]
    : [bound.destination.templatePath, bound.destination.stylePath];
}
