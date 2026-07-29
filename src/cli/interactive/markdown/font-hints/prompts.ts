import { input, select } from "@inquirer/prompts";

import { printLine } from "../../../actions/shared";
import type { CliRuntime } from "../../../types";
import {
  compileMarkdownPdfInteractiveFontHintDraft,
  formatMarkdownPdfInteractiveFontHintPreview,
} from "./compile";
import {
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

interface DraftModeSwitch {
  kind: "switch-mode";
  mode: "builder" | "custom";
  previous: MarkdownPdfInteractiveFontHintDraft;
}

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
): Promise<DraftOutcome | DraftModeSwitch> {
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
    if (action === "back") return action;
    if (action === "builder") {
      return { kind: "switch-mode", mode: "builder", previous: draft };
    }
    text = await promptCompleteCustomText(text);
  }
}

async function promptBuiltDraft(
  runtime: CliRuntime,
  artifact: MarkdownPdfInteractiveFontHintArtifact,
  suggestions: MarkdownPdfInteractiveFontHintSuggestionService,
  current?: MarkdownPdfInteractiveFontHintBuiltDraft,
): Promise<DraftOutcome | DraftModeSwitch> {
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
    if (action === "switch-to-custom") {
      return { kind: "switch-mode", mode: "custom", previous: draft };
    }
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

async function promptDraftEditor(
  runtime: CliRuntime,
  artifact: MarkdownPdfInteractiveFontHintArtifact,
  suggestions: MarkdownPdfInteractiveFontHintSuggestionService,
  mode: "builder" | "custom",
  current?: MarkdownPdfInteractiveFontHintDraft,
): Promise<DraftOutcome> {
  let builtDraft = current?.kind === "built" ? current : undefined;
  let customDraft = current?.kind === "custom" ? current : undefined;
  let activeMode = mode;

  while (true) {
    const outcome =
      activeMode === "builder"
        ? await promptBuiltDraft(runtime, artifact, suggestions, builtDraft)
        : await promptCustomDraft(runtime, customDraft);
    if (typeof outcome === "string" || outcome.kind !== "switch-mode") {
      return outcome;
    }
    if (outcome.previous.kind === "built") {
      builtDraft = outcome.previous;
    } else {
      customDraft = outcome.previous;
    }
    activeMode = outcome.mode;
  }
}

function hintChoices(hints: readonly string[]) {
  return hints.map((hint, index) => ({ name: hint, value: index }));
}

function renderFontHintCollection(runtime: CliRuntime, hints: readonly string[]): void {
  printLine(runtime.stderr, "Font hints:");
  if (hints.length === 0) {
    printLine(runtime.stderr, "- none");
    return;
  }
  for (const [index, hint] of hints.entries()) {
    printLine(runtime.stderr, `${index + 1}. ${hint}`);
  }
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
        renderFontHintCollection(runtime, hints);
        const action = await select<"guided" | "custom" | "edit" | "remove" | "move" | "done">({
          message: "Edit font hints",
          choices: [
            { name: "Add guided font hint", value: "guided" as const },
            { name: "Add complete custom hint", value: "custom" as const },
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
          editIndex === undefined
            ? undefined
            : (drafts.get(draftKey(hints[editIndex] ?? "")) ?? {
                kind: "custom",
                text: hints[editIndex] ?? "",
              });
        const next =
          action === "edit" && currentDraft
            ? await promptDraftEditor(
                runtime,
                artifact,
                suggestions,
                currentDraft.kind === "built" ? "builder" : "custom",
                currentDraft,
              )
            : await promptDraftEditor(
                runtime,
                artifact,
                suggestions,
                action === "guided" ? "builder" : "custom",
              );
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
