import { input, select } from "@inquirer/prompts";

import { printLine } from "../../../actions/shared";
import type { CliRuntime } from "../../../types";
import {
  compileMarkdownPdfInteractiveFontHintDraft,
  formatMarkdownPdfInteractiveFontHintPreview,
} from "./compile";
import {
  buildMarkdownPdfInteractiveFontHintModeChoices,
  buildMarkdownPdfInteractiveFontHintNextStepChoices,
  findExactMarkdownPdfInteractiveFontHintDuplicate,
  moveMarkdownPdfInteractiveFontHint,
  removeMarkdownPdfInteractiveFontHint,
  replaceMarkdownPdfInteractiveFontHint,
} from "./editor";
import { promptMarkdownPdfInteractiveFontHintIntendedUse } from "./intended-use";
import { normalizeMarkdownPdfInteractiveFontHintFamilyName } from "./text";
import type {
  MarkdownPdfInteractiveFontHintArtifact,
  MarkdownPdfInteractiveFontHintBuiltDraft,
  MarkdownPdfInteractiveFontHintDraft,
  MarkdownPdfInteractiveFontHintEditorSession,
  MarkdownPdfInteractiveFontHintIntendedUse,
  MarkdownPdfInteractiveFontHintSuggestionService,
} from "./types";

type DraftOutcome = MarkdownPdfInteractiveFontHintDraft | "back";

function draftKey(compiled: string): string {
  return normalizeMarkdownPdfInteractiveFontHintFamilyName(compiled);
}

function normalizedIntendedUse(
  use: MarkdownPdfInteractiveFontHintIntendedUse,
): MarkdownPdfInteractiveFontHintIntendedUse | undefined {
  return use.kind === "general-body" ? undefined : use;
}

function printDraftPreview(runtime: CliRuntime, draft: MarkdownPdfInteractiveFontHintDraft): void {
  for (const line of formatMarkdownPdfInteractiveFontHintPreview(draft)) {
    printLine(runtime.stderr, line);
  }
}

async function promptCompleteCustomText(current = ""): Promise<string> {
  return (
    await input({
      message: "Complete custom font hint",
      default: current,
      validate: (value) => String(value).trim().length > 0 || "Enter a complete font hint.",
    })
  ).trim();
}

async function promptCustomDraft(
  runtime: CliRuntime,
  current?: Extract<MarkdownPdfInteractiveFontHintDraft, { kind: "custom" }>,
): Promise<DraftOutcome | "builder"> {
  let text = await promptCompleteCustomText(current?.text);
  while (true) {
    const draft = { kind: "custom" as const, text };
    printDraftPreview(runtime, draft);
    const action = await select<"accept" | "revise" | "builder" | "back">({
      message: "Font hint next step",
      choices: [
        { name: "Add this font hint", value: "accept" },
        { name: "Revise complete custom hint", value: "revise" },
        { name: "Build a font hint", value: "builder" },
        { name: "Back", value: "back" },
      ],
    });
    if (action === "accept") return draft;
    if (action === "back" || action === "builder") return action;
    text = await promptCompleteCustomText(text);
  }
}

async function promptBuiltDraft(
  runtime: CliRuntime,
  artifact: MarkdownPdfInteractiveFontHintArtifact,
  suggestions: MarkdownPdfInteractiveFontHintSuggestionService,
  current?: MarkdownPdfInteractiveFontHintBuiltDraft,
): Promise<DraftOutcome | "custom"> {
  let preference = await suggestions.promptPreference(current?.preference);
  if (preference === undefined) return "back";
  let intendedUse = current?.intendedUse;
  if (!current) {
    const selected = await promptMarkdownPdfInteractiveFontHintIntendedUse(artifact);
    if (selected === "back") return "back";
    intendedUse = normalizedIntendedUse(selected);
  }

  while (true) {
    const draft: MarkdownPdfInteractiveFontHintBuiltDraft = {
      kind: "built",
      preference,
      ...(intendedUse ? { intendedUse } : {}),
    };
    printDraftPreview(runtime, draft);
    const action = await select({
      message: "Font hint next step",
      choices: buildMarkdownPdfInteractiveFontHintNextStepChoices(),
    });
    if (action === "accept") return draft;
    if (action === "back") return "back";
    if (action === "switch-to-custom") return "custom";
    if (action === "revise-preference") {
      const revisedPreference = await suggestions.promptPreference(preference);
      if (revisedPreference !== undefined) {
        preference = revisedPreference;
      }
      continue;
    }
    const selected = await promptMarkdownPdfInteractiveFontHintIntendedUse(artifact);
    if (selected !== "back") {
      intendedUse = normalizedIntendedUse(selected);
    }
  }
}

async function promptDraftMode(
  runtime: CliRuntime,
  artifact: MarkdownPdfInteractiveFontHintArtifact,
  suggestions: MarkdownPdfInteractiveFontHintSuggestionService,
): Promise<DraftOutcome> {
  while (true) {
    const suggestionState = suggestions.getState();
    const retryAvailable = suggestionState.kind === "unavailable" && suggestionState.retriable;
    const modeChoices = buildMarkdownPdfInteractiveFontHintModeChoices();
    const mode = await select<"builder" | "custom" | "retry" | "back">({
      message: "Add font hint",
      choices: [
        ...modeChoices.slice(0, -1),
        ...(retryAvailable
          ? [{ name: "Retry installed font suggestions", value: "retry" as const }]
          : []),
        modeChoices.at(-1)!,
      ],
    });
    if (mode === "back") return "back";
    if (mode === "retry") {
      await suggestions.retryUnavailable();
      continue;
    }
    if (mode === "custom") {
      const custom = await promptCustomDraft(runtime);
      if (custom === "builder") continue;
      return custom;
    }
    const built = await promptBuiltDraft(runtime, artifact, suggestions);
    if (built === "custom") {
      const custom = await promptCustomDraft(runtime);
      if (custom === "builder") continue;
      return custom;
    }
    return built;
  }
}

function hintChoices(hints: readonly string[]) {
  return hints.map((hint, index) => ({ name: hint, value: index }));
}

export function createMarkdownPdfInteractiveFontHintEditorSession(
  suggestions: MarkdownPdfInteractiveFontHintSuggestionService,
): MarkdownPdfInteractiveFontHintEditorSession {
  const drafts = new Map<string, MarkdownPdfInteractiveFontHintDraft>();

  const remember = (draft: MarkdownPdfInteractiveFontHintDraft): string => {
    const compiled = compileMarkdownPdfInteractiveFontHintDraft(draft);
    drafts.set(draftKey(compiled), draft);
    return compiled;
  };

  return {
    cancel: () => suggestions.cancel(),
    async edit(runtime, current, artifact) {
      let hints = [...current];
      for (const hint of hints) {
        if (!drafts.has(draftKey(hint))) {
          drafts.set(draftKey(hint), { kind: "custom", text: hint });
        }
      }

      while (true) {
        const action = await select<"add" | "edit" | "remove" | "move" | "done">({
          message: "Edit font hints",
          choices: [
            { name: "Add font hint", value: "add" },
            ...(hints.length > 0
              ? [
                  { name: "Edit font hint", value: "edit" as const },
                  { name: "Remove font hint", value: "remove" as const },
                ]
              : []),
            ...(hints.length > 1 ? [{ name: "Move font hint", value: "move" as const }] : []),
            { name: "Done", value: "done" },
          ],
        });
        if (action === "done") return hints;
        if (action === "remove") {
          const index = await select<number>({
            message: "Remove font hint",
            choices: hintChoices(hints),
          });
          drafts.delete(draftKey(hints[index] ?? ""));
          hints = removeMarkdownPdfInteractiveFontHint(hints, index);
          continue;
        }
        if (action === "move") {
          const index = await select<number>({
            message: "Move font hint",
            choices: hintChoices(hints),
          });
          const direction = await select<"up" | "down" | "back">({
            message: "Move font hint",
            choices: [
              ...(index > 0 ? [{ name: "Move up", value: "up" as const }] : []),
              ...(index < hints.length - 1 ? [{ name: "Move down", value: "down" as const }] : []),
              { name: "Back", value: "back" },
            ],
          });
          if (direction !== "back") {
            hints = moveMarkdownPdfInteractiveFontHint(
              hints,
              index,
              direction === "up" ? index - 1 : index + 1,
            );
          }
          continue;
        }

        const editIndex =
          action === "edit"
            ? await select<number>({ message: "Edit font hint", choices: hintChoices(hints) })
            : undefined;
        const currentDraft =
          editIndex === undefined ? undefined : drafts.get(draftKey(hints[editIndex] ?? ""));
        let next: DraftOutcome;
        if (currentDraft?.kind === "built") {
          const built = await promptBuiltDraft(runtime, artifact, suggestions, currentDraft);
          if (built === "custom") {
            const custom = await promptCustomDraft(runtime);
            next = custom === "builder" ? "back" : custom;
          } else {
            next = built;
          }
        } else if (currentDraft?.kind === "custom") {
          const custom = await promptCustomDraft(runtime, currentDraft);
          if (custom === "builder") {
            const built = await promptBuiltDraft(runtime, artifact, suggestions);
            next = built === "custom" ? "back" : built;
          } else {
            next = custom;
          }
        } else {
          next = await promptDraftMode(runtime, artifact, suggestions);
        }
        if (next === "back") continue;

        const otherHints = hints.filter((_hint, index) => index !== editIndex);
        const duplicate = findExactMarkdownPdfInteractiveFontHintDuplicate(otherHints, next);
        if (duplicate) {
          printLine(runtime.stderr, `That font hint already exists: ${duplicate}`);
          continue;
        }
        const compiled = remember(next);
        if (editIndex === undefined) {
          hints = [...hints, compiled];
        } else {
          drafts.delete(draftKey(hints[editIndex] ?? ""));
          hints = replaceMarkdownPdfInteractiveFontHint(hints, editIndex, compiled);
          drafts.set(draftKey(compiled), next);
        }
      }
    },
  };
}
