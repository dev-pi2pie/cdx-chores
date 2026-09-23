import { confirm, editor, input, select } from "@inquirer/prompts";

import { displayPath, printLine } from "../../actions/shared";
import { promptRequiredPathWithConfig } from "../../prompts/path";
import type { CliRuntime } from "../../types";
import type { InteractivePathPromptContext } from "../shared";
import type { MarkdownPdfCodexArtifact, MarkdownPdfCodexSetup } from "./codex-types";
import type { MarkdownPdfInteractiveFontHintEditorSession } from "./font-hints";
import type { MarkdownPdfInteractiveEntry } from "./types";
import {
  collectMarkdownPdfCodexPageInformation,
  createMarkdownPdfCodexPageInformationPrompts,
  loadMarkdownPdfCodexPageInformationBase,
  type MarkdownPdfCodexPageInformationAnswers,
  type MarkdownPdfCodexPageInformationPrompts,
} from "./codex-page-information";
import type { NormalizedMarkdownPdfProfile } from "../../markdown-pdf/profile";

type CodexSetupOutcome =
  | { kind: "setup"; setup: MarkdownPdfCodexSetup }
  | { kind: "back" }
  | { kind: "cancel" };

type CodexSetupAction =
  | "continue"
  | "intent"
  | "base-profile"
  | "clear-base-profile"
  | "font-hints"
  | "page-information"
  | "cover-image"
  | "clear-cover-image"
  | "back"
  | "cancel";

function artifactLabel(artifact: MarkdownPdfCodexArtifact): string {
  return artifact === "profile"
    ? "Profile"
    : artifact === "template-bundle"
      ? "Template bundle"
      : "Project bundle";
}

function normalizedOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function hasExplicitPageInformation(
  answers: MarkdownPdfCodexPageInformationAnswers | undefined,
): boolean {
  return Boolean(answers?.pageNumbers || answers?.repeatingContent);
}

function withPageInformation(
  setup: MarkdownPdfCodexSetup,
  answers: MarkdownPdfCodexPageInformationAnswers | undefined,
): MarkdownPdfCodexSetup {
  const { pageInformation: _previous, ...rest } = setup;
  return answers ? { ...rest, pageInformation: answers } : rest;
}

const PDF_INTENT_PROMPT = "PDF intent (optional)";
const PDF_INTENT_SINGLE_LINE_PROMPT = `${PDF_INTENT_PROMPT}\n `;

async function promptPdfIntent(current?: string): Promise<string | undefined> {
  const useMultilineEditor = await confirm({
    message: "Use multiline editor?",
    default: false,
  });
  const value = useMultilineEditor
    ? await editor({
        message: PDF_INTENT_PROMPT,
        default: current ?? "",
        postfix: ".md",
      })
    : await input({
        message: PDF_INTENT_SINGLE_LINE_PROMPT,
        default: current ?? "",
      });
  return normalizedOptionalText(value);
}

async function promptOptionalSample(
  pathPromptContext: InteractivePathPromptContext,
): Promise<{ kind: "sample"; sample?: string } | { kind: "back" } | { kind: "cancel" }> {
  const choice = await select<"none" | "choose" | "back" | "cancel">({
    message: "Markdown preparation sample",
    choices: [
      {
        name: "Continue without a sample",
        value: "none",
        description: "Use other selected signals only",
      },
      {
        name: "Choose a Markdown sample",
        value: "choose",
        description: "Use bounded document-informed signals",
      },
      { name: "Back", value: "back", description: "Choose another artifact" },
      { name: "Cancel", value: "cancel", description: "Exit without writing" },
    ],
  });
  if (choice === "back" || choice === "cancel") {
    return { kind: choice };
  }
  if (choice === "none") {
    return { kind: "sample" };
  }
  return {
    kind: "sample",
    sample: await promptRequiredPathWithConfig("Markdown sample file", {
      kind: "file",
      ...pathPromptContext,
    }),
  };
}

function renderSetup(runtime: CliRuntime, setup: MarkdownPdfCodexSetup): void {
  printLine(runtime.stderr, `${artifactLabel(setup.artifact)} setup`);
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, `Intent: ${setup.intent ?? "none"}`);
  if (setup.pageInformation) {
    printLine(
      runtime.stderr,
      `Page numbers: ${setup.pageInformation.pageNumbers ? (setup.pageInformation.pageNumbers.enabled ? "ON" : "OFF") : "unspecified"}`,
    );
    printLine(
      runtime.stderr,
      `Repeating content: ${setup.pageInformation.repeatingContent ? (setup.pageInformation.repeatingContent.enabled ? "ON" : "OFF") : "unspecified"}`,
    );
  }
  printLine(
    runtime.stderr,
    `Markdown sample: ${setup.sample ? displayPath(runtime, setup.sample) : "none"}`,
  );
  printLine(
    runtime.stderr,
    `Base profile: ${setup.baseProfile ? displayPath(runtime, setup.baseProfile) : "none"}`,
  );
  if (setup.artifact !== "profile") {
    printLine(
      runtime.stderr,
      `Cover image: ${setup.coverImage ? displayPath(runtime, setup.coverImage) : "none"}`,
    );
  }
  printLine(runtime.stderr, "Font hints:");
  if (setup.fontHints.length === 0) {
    printLine(runtime.stderr, "- none");
  } else {
    for (const hint of setup.fontHints) {
      printLine(runtime.stderr, `- ${hint}`);
    }
  }
}

export async function collectMarkdownPdfCodexSetup(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  context: {
    artifact: MarkdownPdfCodexArtifact;
    entry: MarkdownPdfInteractiveEntry;
    initialSetup?: MarkdownPdfCodexSetup;
    fontHintEditor: MarkdownPdfInteractiveFontHintEditorSession;
    markdownInput?: string;
    /** Optional prompt and base-loader overrides for injected tests. */
    internalPageInformation?: {
      prompts?: MarkdownPdfCodexPageInformationPrompts;
      loadBase?: (path: string) => Promise<NormalizedMarkdownPdfProfile>;
    };
  },
): Promise<CodexSetupOutcome> {
  const pageInformationEnabled = context.artifact !== "template-bundle";
  const pageInformationPrompts =
    context.internalPageInformation?.prompts ??
    createMarkdownPdfCodexPageInformationPrompts(pathPromptContext);
  const loadBase =
    context.internalPageInformation?.loadBase ??
    ((path: string) => loadMarkdownPdfCodexPageInformationBase(runtime.cwd, path));
  let setup = context.initialSetup;
  if (!setup) {
    const sampleOutcome =
      context.entry === "to-pdf"
        ? { kind: "sample" as const, sample: context.markdownInput }
        : await promptOptionalSample(pathPromptContext);
    if (sampleOutcome.kind === "back" || sampleOutcome.kind === "cancel") {
      return sampleOutcome;
    }
    const pageInformationOutcome = pageInformationEnabled
      ? await collectMarkdownPdfCodexPageInformation({
          mode: "initial",
          prompts: pageInformationPrompts,
        })
      : undefined;
    if (pageInformationOutcome?.kind === "back" || pageInformationOutcome?.kind === "cancel") {
      return pageInformationOutcome;
    }
    setup = {
      artifact: context.artifact,
      fontHints: [],
      intent: await promptPdfIntent(),
      sample: sampleOutcome.sample,
      ...(pageInformationOutcome?.kind === "answers" && pageInformationOutcome.answers
        ? { pageInformation: pageInformationOutcome.answers }
        : {}),
    };
  }

  while (true) {
    renderSetup(runtime, setup);
    const action: CodexSetupAction = await select<CodexSetupAction>({
      message: `${artifactLabel(context.artifact)} setup next step`,
      choices: [
        { name: setup.intent ? "Revise PDF intent" : "Set PDF intent", value: "intent" },
        { name: "Set base profile", value: "base-profile" },
        ...(setup.baseProfile
          ? [{ name: "Clear base profile", value: "clear-base-profile" as const }]
          : []),
        ...(context.artifact !== "profile"
          ? [
              { name: "Set cover image", value: "cover-image" as const },
              ...(setup.coverImage
                ? [{ name: "Clear cover image", value: "clear-cover-image" as const }]
                : []),
            ]
          : []),
        { name: "Edit font hints", value: "font-hints" },
        ...(pageInformationEnabled
          ? [{ name: "Page information setup", value: "page-information" as const }]
          : []),
        { name: "Continue", value: "continue" },
        { name: "Back", value: "back" },
        { name: "Cancel", value: "cancel" },
      ],
    });
    if (action === "continue") {
      return { kind: "setup", setup };
    }
    if (action === "back" || action === "cancel") {
      return { kind: action };
    }
    if (action === "intent") {
      setup = {
        ...setup,
        intent: await promptPdfIntent(setup.intent),
      };
      continue;
    }
    if (action === "font-hints") {
      setup = {
        ...setup,
        fontHints: await context.fontHintEditor.edit(runtime, setup.fontHints, context.artifact),
      };
      continue;
    }
    if (action === "page-information") {
      const outcome = await collectMarkdownPdfCodexPageInformation({
        mode: "revision",
        current: setup.pageInformation,
        ...(setup.baseProfile ? { base: await loadBase(setup.baseProfile) } : {}),
        prompts: pageInformationPrompts,
      });
      if (outcome.kind === "cancel") return outcome;
      if (outcome.kind === "answers") setup = withPageInformation(setup, outcome.answers);
      continue;
    }
    if (action === "clear-base-profile") {
      const { baseProfile: _baseProfile, ...next } = setup;
      if (pageInformationEnabled && hasExplicitPageInformation(next.pageInformation)) {
        const outcome = await collectMarkdownPdfCodexPageInformation({
          mode: "revision",
          current: { ...next.pageInformation, occupiedNumberSlot: undefined },
          prompts: pageInformationPrompts,
        });
        if (outcome.kind === "cancel") return outcome;
        if (outcome.kind === "back") continue;
        setup = withPageInformation(next, outcome.answers);
      } else {
        setup = next;
      }
      continue;
    }
    if (action === "clear-cover-image") {
      const { coverImage: _coverImage, ...next } = setup;
      setup = next;
      continue;
    }
    const path = await promptRequiredPathWithConfig(
      action === "base-profile" ? "Base profile file" : "Cover image file",
      {
        kind: "file",
        ...pathPromptContext,
      },
    );
    if (
      action === "base-profile" &&
      pageInformationEnabled &&
      hasExplicitPageInformation(setup.pageInformation)
    ) {
      const outcome = await collectMarkdownPdfCodexPageInformation({
        mode: "revision",
        current: { ...setup.pageInformation, occupiedNumberSlot: undefined },
        base: await loadBase(path),
        prompts: pageInformationPrompts,
      });
      if (outcome.kind === "cancel") return outcome;
      if (outcome.kind === "back") continue;
      setup = withPageInformation({ ...setup, baseProfile: path }, outcome.answers);
    } else {
      setup =
        action === "base-profile"
          ? { ...setup, baseProfile: path }
          : { ...setup, coverImage: path };
    }
  }
}
