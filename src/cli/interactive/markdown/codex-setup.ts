import { input, select } from "@inquirer/prompts";

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
  | "font-hints"
  | "cover-image"
  | "output"
  | "clear-output"
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
        message: "Font family hint",
        validate: (value) => value.trim().length > 0 || "Enter a font family.",
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
  printLine(
    runtime.stderr,
    `Font hints: ${setup.fontHints.length > 0 ? setup.fontHints.join(", ") : "none"}`,
  );
  if (setup.artifact !== "profile") {
    printLine(
      runtime.stderr,
      `Cover image: ${setup.coverImage ? displayPath(runtime, setup.coverImage) : "none"}`,
    );
  }
  if (setup.artifact === "project-bundle" && setup.outputPreference) {
    printLine(runtime.stderr, `Output directory: ${displayPath(runtime, setup.outputPreference)}`);
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
      intent: normalizedOptionalText(
        await input({ message: "Describe the PDF direction (optional)", default: "" }),
      ),
      sample: sampleOutcome.sample,
    };
  }

  while (true) {
    renderSetup(runtime, setup);
    const action: CodexSetupAction = await select<CodexSetupAction>({
      message: `${artifactLabel(context.artifact)} setup next step`,
      choices: [
        { name: "Continue", value: "continue" },
        { name: "Revise intent", value: "intent" },
        { name: "Set base profile", value: "base-profile" },
        { name: "Edit font hints", value: "font-hints" },
        ...(context.artifact !== "profile"
          ? [{ name: "Set cover image", value: "cover-image" as const }]
          : []),
        ...(context.artifact === "project-bundle"
          ? [
              { name: "Set output directory", value: "output" as const },
              ...(setup.outputPreference
                ? [{ name: "Clear output directory", value: "clear-output" as const }]
                : []),
            ]
          : []),
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
        intent: normalizedOptionalText(
          await input({
            message: "Describe the PDF direction (optional)",
            default: setup.intent ?? "",
          }),
        ),
      };
      continue;
    }
    if (action === "font-hints") {
      setup = { ...setup, fontHints: await editFontHints(setup.fontHints) };
      continue;
    }
    if (action === "clear-output") {
      const { outputPreference: _outputPreference, ...next } = setup;
      setup = next;
      continue;
    }
    const path = await promptRequiredPathWithConfig(
      action === "base-profile"
        ? "Base profile file"
        : action === "cover-image"
          ? "Cover image file"
          : "Project bundle output directory",
      {
        kind: action === "output" ? "directory" : "file",
        ...pathPromptContext,
      },
    );
    setup =
      action === "base-profile"
        ? { ...setup, baseProfile: path }
        : action === "cover-image"
          ? { ...setup, coverImage: path }
          : { ...setup, outputPreference: path };
  }
}
