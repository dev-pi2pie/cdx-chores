import { confirm, editor, input, select } from "@inquirer/prompts";

import { displayPath, printLine } from "../../actions/shared";
import { promptRequiredPathWithConfig } from "../../prompts/path";
import type { CliRuntime } from "../../types";
import type { InteractivePathPromptContext } from "../shared";
import type { MarkdownPdfCodexArtifact, MarkdownPdfCodexSetup } from "./codex-types";
import type { MarkdownPdfInteractiveEntry } from "./types";

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

const PDF_INTENT_PROMPT =
  "Describe the PDF intent:\n  Optional. Describe the audience, tone, layout, or visual direction.";

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
        message: PDF_INTENT_PROMPT,
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

async function editFontHints(current: readonly string[]): Promise<string[]> {
  const hints = [...current];
  while (true) {
    const action = await select<"add" | "remove" | "done">({
      message: "Edit font hints",
      choices: [
        { name: "Add font hint", value: "add" },
        ...(hints.length > 0 ? [{ name: "Remove font hint", value: "remove" as const }] : []),
        { name: "Done", value: "done" },
      ],
    });
    if (action === "done") {
      return hints;
    }
    if (action === "remove") {
      const removed = await select<string>({
        message: "Remove font hint",
        choices: hints.map((hint) => ({ name: hint, value: hint })),
      });
      hints.splice(hints.indexOf(removed), 1);
      continue;
    }
    const hint = (
      await input({
        message: "Font preference",
        validate: (value) => value.trim().length > 0 || "Enter a font preference.",
      })
    ).trim();
    if (!hints.includes(hint)) {
      hints.push(hint);
    }
  }
}

function renderSetup(runtime: CliRuntime, setup: MarkdownPdfCodexSetup): void {
  printLine(runtime.stderr, `${artifactLabel(setup.artifact)} setup`);
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, `Intent: ${setup.intent ?? "none"}`);
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
    markdownInput?: string;
  },
): Promise<CodexSetupOutcome> {
  let setup = context.initialSetup;
  if (!setup) {
    const sampleOutcome =
      context.entry === "to-pdf"
        ? { kind: "sample" as const, sample: context.markdownInput }
        : await promptOptionalSample(pathPromptContext);
    if (sampleOutcome.kind === "back" || sampleOutcome.kind === "cancel") {
      return sampleOutcome;
    }
    setup = {
      artifact: context.artifact,
      fontHints: [],
      intent: await promptPdfIntent(),
      sample: sampleOutcome.sample,
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
      setup = { ...setup, fontHints: await editFontHints(setup.fontHints) };
      continue;
    }
    if (action === "clear-base-profile") {
      const { baseProfile: _baseProfile, ...next } = setup;
      setup = next;
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
    setup =
      action === "base-profile" ? { ...setup, baseProfile: path } : { ...setup, coverImage: path };
  }
}
