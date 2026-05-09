import { checkbox, confirm, input, select } from "@inquirer/prompts";

import type {
  RenameCleanupConflictStrategy,
  RenameCleanupHint,
  RenameCleanupOptions,
  RenameCleanupPathKind,
  RenameCleanupStyle,
  RenameCleanupTimestampAction,
} from "../../actions";
import { validateIntegerInput } from "../input-validation";

export interface InteractiveCleanupSettings {
  hints: RenameCleanupHint[];
  style: RenameCleanupStyle;
  timestampAction?: RenameCleanupTimestampAction;
}

export type RenameCleanupScopeOptions = Pick<
  RenameCleanupOptions,
  "recursive" | "maxDepth" | "matchRegex" | "skipRegex" | "ext" | "skipExt"
>;

const INTERACTIVE_CLEANUP_HINT_CHOICES: Array<{
  name: string;
  value: RenameCleanupHint;
  description: string;
}> = [
  {
    name: "timestamp",
    value: "timestamp",
    description: "Date-plus-time fragments such as macOS screenshot timestamps",
  },
  { name: "date", value: "date", description: "Date-only fragments such as 2026-03-03" },
  { name: "serial", value: "serial", description: "Trailing counters such as (2), -01, or _003" },
  { name: "uid", value: "uid", description: "Existing uid-<token> fragments" },
];

export const ANALYZER_FAMILY_VALUES = INTERACTIVE_CLEANUP_HINT_CHOICES.map(
  (choice) => choice.value,
) as RenameCleanupHint[];

function parseInteractiveCsvList(value: string): string[] | undefined {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items.length > 0 ? items : undefined;
}

async function promptInteractiveCleanupHints(): Promise<RenameCleanupHint[]> {
  const selected: RenameCleanupHint[] = [];

  while (true) {
    const remainingChoices = INTERACTIVE_CLEANUP_HINT_CHOICES.filter(
      (choice) => !selected.includes(choice.value),
    );
    const choice = await select<RenameCleanupHint | "done">({
      message: selected.length === 0 ? "Add a cleanup hint" : "Add another cleanup hint or finish",
      choices: [
        ...remainingChoices,
        ...(selected.length > 0
          ? [
              {
                name: "done",
                value: "done" as const,
                description: `Selected: ${selected.join(", ")}`,
              },
            ]
          : []),
      ],
    });

    if (choice === "done") {
      return selected;
    }

    selected.push(choice);
  }
}

export async function promptCleanupAnalyzerFamilies(): Promise<RenameCleanupHint[]> {
  const selected = await checkbox<RenameCleanupHint>({
    message: "Analyzer families to focus on (all selected by default)",
    choices: INTERACTIVE_CLEANUP_HINT_CHOICES.map((choice) => ({
      ...choice,
      checked: true,
    })),
    required: false,
  });

  // Empty selection keeps the null/default full-scope behavior.
  return selected.length > 0 ? [...new Set(selected)] : [...ANALYZER_FAMILY_VALUES];
}

async function promptCleanupStyle(): Promise<RenameCleanupStyle> {
  return select<RenameCleanupStyle>({
    message: "Cleanup output style",
    choices: [
      {
        name: "preserve",
        value: "preserve",
        description: "Keep readable spacing while normalizing matched fragments",
      },
      {
        name: "slug",
        value: "slug",
        description: "Convert the remaining text to kebab-case",
      },
    ],
    default: "preserve",
  });
}

async function promptCleanupTimestampAction(): Promise<RenameCleanupTimestampAction> {
  return select<RenameCleanupTimestampAction>({
    message: "Timestamp fragment handling",
    choices: [
      {
        name: "keep",
        value: "keep",
        description: "Keep matched timestamps in normalized form",
      },
      {
        name: "remove",
        value: "remove",
        description: "Remove matched timestamps from the basename",
      },
    ],
    default: "keep",
  });
}

export async function promptManualCleanupSettings(): Promise<InteractiveCleanupSettings> {
  const hints = await promptInteractiveCleanupHints();
  const style = await promptCleanupStyle();
  const timestampAction = hints.includes("timestamp")
    ? await promptCleanupTimestampAction()
    : undefined;
  return { hints, style, timestampAction };
}

export async function promptCleanupScopeOptions(
  pathKind: RenameCleanupPathKind,
): Promise<RenameCleanupScopeOptions> {
  const recursive =
    pathKind === "directory"
      ? await confirm({
          message: "Traverse subdirectories recursively?",
          default: false,
        })
      : false;
  const maxDepthInput =
    pathKind === "directory" && recursive
      ? await input({
          message: "Max recursive depth (optional, root=0)",
          default: "",
          validate: (value) => validateIntegerInput(value, { min: 0, allowEmpty: true }),
        })
      : "";
  const filterFiles =
    pathKind === "directory"
      ? await confirm({
          message: "Filter files before cleanup?",
          default: false,
        })
      : false;
  const matchRegex =
    pathKind === "directory" && filterFiles
      ? await input({ message: "Match regex (optional)", default: "" })
      : "";
  const skipRegex =
    pathKind === "directory" && filterFiles
      ? await input({ message: "Skip regex (optional)", default: "" })
      : "";
  const extInput =
    pathKind === "directory" && filterFiles
      ? await input({
          message: "Only extensions (optional, comma-separated)",
          default: "",
        })
      : "";
  const skipExtInput =
    pathKind === "directory" && filterFiles
      ? await input({
          message: "Skip extensions (optional, comma-separated)",
          default: "",
        })
      : "";

  return {
    recursive: pathKind === "directory" ? recursive : undefined,
    maxDepth: maxDepthInput.trim() ? Number(maxDepthInput.trim()) : undefined,
    matchRegex: matchRegex.trim() ? matchRegex.trim() : undefined,
    skipRegex: skipRegex.trim() ? skipRegex.trim() : undefined,
    ext: parseInteractiveCsvList(extInput),
    skipExt: parseInteractiveCsvList(skipExtInput),
  };
}

export async function promptCleanupConflictStrategy(): Promise<RenameCleanupConflictStrategy> {
  return select<RenameCleanupConflictStrategy>({
    message: "Cleanup conflict strategy",
    choices: [
      {
        name: "skip",
        value: "skip",
        description: "Keep the clean target when free and skip only the conflicted rows",
      },
      {
        name: "number",
        value: "number",
        description: "Append -1, -2, -3 only when the cleaned target conflicts",
      },
      {
        name: "uid-suffix",
        value: "uid-suffix",
        description: "Append -uid-<token> only when the cleaned target conflicts",
      },
    ],
    default: "skip",
  });
}
