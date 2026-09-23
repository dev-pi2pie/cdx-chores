import { select } from "@inquirer/prompts";

import {
  DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
  MARKDOWN_PDF_PAGE_CHROME_POSITIONS,
  resolveMarkdownPdfPageNumberSlot,
  type MarkdownPdfPageChromePosition,
  type NormalizedMarkdownPdfProfile,
} from "../../markdown-pdf/profile";
import { loadMarkdownPdfBaseProfileCandidate } from "../../markdown-pdf/profile/candidates";
import { normalizeMarkdownPdfProfile } from "../../markdown-pdf/profile";
import type { MarkdownPdfPageInformationConflictError } from "../../markdown-pdf/profile-codex";
import type { InteractivePathPromptContext } from "../shared";
import {
  compileMarkdownPdfFormalGuidePageNumbers,
  createMarkdownPdfFormalGuidePrompts,
  type MarkdownPdfFormalGuidePageNumberAnswers,
  type MarkdownPdfFormalGuidePrompts,
} from "./formal-guide";

export interface MarkdownPdfCodexRepeatingContentAnswers {
  enabled: boolean;
  /** Inactive draft while OFF: never materialize, send as a signal, or report these values. */
  selected: MarkdownPdfPageChromePosition[];
  text: Partial<Record<MarkdownPdfPageChromePosition, string>>;
}

export interface MarkdownPdfCodexPageInformationAnswers {
  /** Omission means preserve the candidate's page-number choice. */
  pageNumbers?: MarkdownPdfFormalGuidePageNumberAnswers;
  /** Omission means preserve the candidate's repeating-content choice. */
  repeatingContent?: MarkdownPdfCodexRepeatingContentAnswers;
  /** An existing candidate slot can be cleared or retained after exact review. */
  occupiedNumberSlot?: {
    position: MarkdownPdfPageChromePosition;
    choice: "clear" | "retain";
    /** Internal comparison only; never print or include in a diagnostic report. */
    conflictingText: string;
    source?: "model";
    candidateAbsentConfirmed?: boolean;
  };
}

export type MarkdownPdfCodexLateConflict = Pick<
  MarkdownPdfPageInformationConflictError,
  "position" | "text" | "source"
> & { candidateAbsent?: boolean };

export type MarkdownPdfCodexPageInformationAction =
  | "numbers"
  | "repeating"
  | "remove-numbers"
  | "remove-repeating"
  | "continue"
  | "back"
  | "cancel";

export interface MarkdownPdfCodexPageInformationPrompts {
  initial(): Promise<"skip" | "edit" | "back" | "cancel">;
  action(
    answers: Readonly<MarkdownPdfCodexPageInformationAnswers>,
  ): Promise<MarkdownPdfCodexPageInformationAction>;
  conflict(position: MarkdownPdfPageChromePosition): Promise<void>;
  formalGuide: Pick<
    MarkdownPdfFormalGuidePrompts,
    | "pageNumbersEnabled"
    | "pageNumberOutcome"
    | "pageNumberLabel"
    | "pageNumberPosition"
    | "repeatingContentEnabled"
    | "repeatingContentPositions"
    | "repeatingContent"
    | "clearOccupiedPageNumberPosition"
  >;
}

export type MarkdownPdfCodexPageInformationOutcome =
  | { kind: "answers"; answers?: MarkdownPdfCodexPageInformationAnswers }
  | { kind: "back" }
  | { kind: "cancel" };

function contentAt(
  base: Readonly<NormalizedMarkdownPdfProfile> | undefined,
  position: MarkdownPdfPageChromePosition,
): string {
  if (!base) return "";
  const { area, slot } = resolveMarkdownPdfPageNumberSlot(position);
  return base[area][slot];
}

function reservedPosition(
  answers: Readonly<MarkdownPdfCodexPageInformationAnswers>,
  base: Readonly<NormalizedMarkdownPdfProfile> | undefined,
): MarkdownPdfPageChromePosition | undefined {
  const numbers = answers.pageNumbers ?? base?.pageNumbers;
  return numbers?.enabled ? numbers.position : undefined;
}

function selectedConflict(
  answers: Readonly<MarkdownPdfCodexPageInformationAnswers>,
  base: Readonly<NormalizedMarkdownPdfProfile> | undefined,
): MarkdownPdfPageChromePosition | undefined {
  const reserved = reservedPosition(answers, base);
  return reserved &&
    answers.repeatingContent?.enabled &&
    answers.repeatingContent.selected.includes(reserved)
    ? reserved
    : undefined;
}

async function reconcileOccupiedNumberSlot(
  answers: MarkdownPdfCodexPageInformationAnswers,
  base: Readonly<NormalizedMarkdownPdfProfile> | undefined,
  prompts: MarkdownPdfCodexPageInformationPrompts,
): Promise<MarkdownPdfCodexPageInformationAnswers> {
  const reserved = reservedPosition(answers, base);
  const explicitAuthority =
    answers.pageNumbers?.enabled === true || answers.repeatingContent?.enabled === true;
  if (
    !explicitAuthority ||
    !reserved ||
    answers.repeatingContent?.enabled === false ||
    !contentAt(base, reserved).trim()
  ) {
    const { occupiedNumberSlot: _previous, ...rest } = answers;
    return rest;
  }
  if (selectedConflict(answers, base)) return answers;
  const conflictingText = contentAt(base, reserved);
  if (
    answers.occupiedNumberSlot?.position === reserved &&
    answers.occupiedNumberSlot.conflictingText === conflictingText
  )
    return answers;
  const clear = await prompts.formalGuide.clearOccupiedPageNumberPosition({
    position: reserved,
    current: conflictingText,
  });
  return {
    ...answers,
    occupiedNumberSlot: { position: reserved, choice: clear ? "clear" : "retain", conflictingText },
  };
}

async function editNumbers(
  current: MarkdownPdfFormalGuidePageNumberAnswers | undefined,
  base: Readonly<NormalizedMarkdownPdfProfile> | undefined,
  prompts: MarkdownPdfCodexPageInformationPrompts,
): Promise<MarkdownPdfFormalGuidePageNumberAnswers> {
  const retained =
    current ?? base?.pageNumbers ?? DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers;
  const enabled = await prompts.formalGuide.pageNumbersEnabled({ current: current?.enabled });
  if (!enabled) {
    const result = { ...retained, enabled: false };
    compileMarkdownPdfFormalGuidePageNumbers(result);
    return result;
  }
  const outcome = await prompts.formalGuide.pageNumberOutcome({
    current: retained.scope === retained.countFrom ? retained.scope : undefined,
  });
  const result: MarkdownPdfFormalGuidePageNumberAnswers = {
    enabled: true,
    scope: outcome,
    countFrom: outcome,
    start: 1,
    increment: 1,
    format: await prompts.formalGuide.pageNumberLabel({ current: current?.format }),
    position: await prompts.formalGuide.pageNumberPosition({ current: retained.position }),
  };
  compileMarkdownPdfFormalGuidePageNumbers(result);
  return result;
}

async function editRepeating(
  current: MarkdownPdfCodexRepeatingContentAnswers | undefined,
  base: Readonly<NormalizedMarkdownPdfProfile> | undefined,
  reserved: MarkdownPdfPageChromePosition | undefined,
  prompts: MarkdownPdfCodexPageInformationPrompts,
): Promise<MarkdownPdfCodexRepeatingContentAnswers> {
  const enabled = await prompts.formalGuide.repeatingContentEnabled({ current: current?.enabled });
  const selected =
    current?.selected ??
    MARKDOWN_PDF_PAGE_CHROME_POSITIONS.filter(
      (position) => position !== reserved && Boolean(contentAt(base, position).trim()),
    );
  const text = { ...current?.text };
  if (!enabled) return { enabled: false, selected: [...selected], text };
  const available = MARKDOWN_PDF_PAGE_CHROME_POSITIONS.filter((position) => position !== reserved);
  const positions = await prompts.formalGuide.repeatingContentPositions({
    available,
    current: selected.filter((position) => position !== reserved),
    ...(reserved ? { reserved } : {}),
  });
  const availableSet = new Set(available);
  for (const position of positions) {
    if (!availableSet.has(position)) {
      throw new Error(`Repeating-content position is not available: ${position}`);
    }
    text[position] = await prompts.formalGuide.repeatingContent({
      position,
      ...((text[position] ?? contentAt(base, position))
        ? { current: text[position] ?? contentAt(base, position) }
        : {}),
    });
  }
  return { enabled: true, selected: [...positions], text };
}

/** Internal collector. No normal Interactive call site enables this path before Phase 4. */
export async function collectMarkdownPdfCodexPageInformation(input: {
  base?: Readonly<NormalizedMarkdownPdfProfile>;
  current?: Readonly<MarkdownPdfCodexPageInformationAnswers>;
  mode: "initial" | "revision";
  prompts: MarkdownPdfCodexPageInformationPrompts;
}): Promise<MarkdownPdfCodexPageInformationOutcome> {
  if (input.mode === "initial") {
    const initial = await input.prompts.initial();
    if (initial === "skip") return { kind: "answers" };
    if (initial === "back" || initial === "cancel") return { kind: initial };
  }
  let answers: MarkdownPdfCodexPageInformationAnswers = {
    ...input.current,
    ...(input.current?.repeatingContent
      ? {
          repeatingContent: {
            ...input.current.repeatingContent,
            selected: [...input.current.repeatingContent.selected],
            text: { ...input.current.repeatingContent.text },
          },
        }
      : {}),
  };
  while (true) {
    const action = await input.prompts.action(answers);
    if (action === "back" || action === "cancel") return { kind: action };
    if (action === "continue") {
      const conflict = selectedConflict(answers, input.base);
      if (conflict) {
        await input.prompts.conflict(conflict);
        continue;
      }
      answers = await reconcileOccupiedNumberSlot(answers, input.base, input.prompts);
      return {
        kind: "answers",
        ...(answers.pageNumbers || answers.repeatingContent ? { answers } : {}),
      };
    }
    if (action === "numbers") {
      answers = {
        ...answers,
        pageNumbers: await editNumbers(answers.pageNumbers, input.base, input.prompts),
      };
    } else if (action === "repeating") {
      answers = {
        ...answers,
        repeatingContent: await editRepeating(
          answers.repeatingContent,
          input.base,
          reservedPosition(answers, input.base),
          input.prompts,
        ),
      };
    } else if (action === "remove-numbers") {
      const { pageNumbers: _removed, ...rest } = answers;
      answers = rest;
    } else if (action === "remove-repeating") {
      const { repeatingContent: _removed, ...rest } = answers;
      answers = rest;
    }
    // The decision belongs to this base and effective number position only.
    answers = await reconcileOccupiedNumberSlot(answers, input.base, input.prompts);
  }
}

/** Resolve a post-preparation conflict in Interactive, without prompting inside a helper. */
export async function reviseMarkdownPdfCodexPageInformationConflict(input: {
  base?: Readonly<NormalizedMarkdownPdfProfile>;
  conflict: MarkdownPdfCodexLateConflict;
  current: Readonly<MarkdownPdfCodexPageInformationAnswers>;
  prompts: MarkdownPdfCodexPageInformationPrompts;
}): Promise<MarkdownPdfCodexPageInformationOutcome> {
  if (input.conflict.source === "explicit") {
    await input.prompts.conflict(input.conflict.position);
    let current = input.current;
    while (true) {
      const outcome = await collectMarkdownPdfCodexPageInformation({
        base: input.base,
        current,
        mode: "revision",
        prompts: input.prompts,
      });
      if (outcome.kind !== "answers") return outcome;
      const answers = outcome.answers;
      const stillSelected =
        answers?.repeatingContent?.enabled &&
        answers.repeatingContent.selected.includes(input.conflict.position);
      const movedOrDisabledNumber =
        answers?.pageNumbers &&
        (!answers.pageNumbers.enabled || answers.pageNumbers.position !== input.conflict.position);
      if (!stillSelected || movedOrDisabledNumber) return outcome;
      await input.prompts.conflict(input.conflict.position);
      current = answers;
    }
  }
  const clear = await input.prompts.formalGuide.clearOccupiedPageNumberPosition({
    position: input.conflict.position,
    current: input.conflict.text,
  });
  const fromModel = contentAt(input.base, input.conflict.position) !== input.conflict.text;
  return {
    kind: "answers",
    answers: {
      ...input.current,
      occupiedNumberSlot: {
        position: input.conflict.position,
        choice: clear ? "clear" : "retain",
        conflictingText: input.conflict.text,
        ...(fromModel ? { source: "model" as const } : {}),
        ...(fromModel && input.conflict.candidateAbsent && !clear
          ? { candidateAbsentConfirmed: true }
          : {}),
      },
    },
  };
}

export async function loadMarkdownPdfCodexPageInformationBase(
  cwd: string,
  path: string,
): Promise<NormalizedMarkdownPdfProfile> {
  const candidate = await loadMarkdownPdfBaseProfileCandidate({ cwd, path });
  return normalizeMarkdownPdfProfile({ profile: candidate.fullProfile }).profile;
}

export function createMarkdownPdfCodexPageInformationPrompts(
  pathPromptContext: InteractivePathPromptContext,
): MarkdownPdfCodexPageInformationPrompts {
  return {
    formalGuide: createMarkdownPdfFormalGuidePrompts(pathPromptContext),
    initial: async () =>
      await select({
        message: "Specify page information in this Profile?",
        choices: [
          { name: "Continue without an explicit choice", value: "skip" },
          { name: "Set page information", value: "edit" },
          { name: "Back", value: "back" },
          { name: "Cancel", value: "cancel" },
        ],
      }),
    action: async (answers) =>
      await select<MarkdownPdfCodexPageInformationAction>({
        message: "Page information setup",
        choices: [
          { name: "Edit page numbers", value: "numbers" },
          ...(answers.pageNumbers
            ? [{ name: "Remove explicit page-number choice", value: "remove-numbers" as const }]
            : []),
          { name: "Edit repeating header/footer text", value: "repeating" },
          ...(answers.repeatingContent
            ? [
                {
                  name: "Remove explicit repeating-content choice",
                  value: "remove-repeating" as const,
                },
              ]
            : []),
          { name: "Continue", value: "continue" },
          { name: "Back", value: "back" },
          { name: "Cancel", value: "cancel" },
        ],
      }),
    conflict: async (position) => {
      await select({
        message: `Repeating text is selected at ${position}, which page numbers now use. Revise one group.`,
        choices: [{ name: "Revise page information", value: "revise" }],
      });
    },
  };
}
