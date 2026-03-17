import { select } from "@inquirer/prompts";

export type InteractiveActionKey =
  | "doctor"
  | "data:preview"
  | "data:convert"
  | "data:query"
  | "data:parquet-preview"
  | "data:json-to-csv"
  | "data:json-to-tsv"
  | "data:csv-to-json"
  | "data:csv-to-tsv"
  | "data:tsv-to-csv"
  | "data:tsv-to-json"
  | "md:to-docx"
  | "md:frontmatter-to-json"
  | "rename:file"
  | "rename:batch"
  | "rename:cleanup"
  | "rename:apply"
  | "video:convert"
  | "video:resize"
  | "video:gif";

export type DataInteractiveActionKey = Extract<InteractiveActionKey, `data:${string}`>;
export type MarkdownInteractiveActionKey = Extract<InteractiveActionKey, `md:${string}`>;
export type RenameInteractiveActionKey = Extract<InteractiveActionKey, `rename:${string}`>;
export type VideoInteractiveActionKey = Extract<InteractiveActionKey, `video:${string}`>;

type InteractiveRootChoice = "doctor" | "data" | "md" | "rename" | "video" | "cancel";
type InteractiveSubmenuGroup = Exclude<InteractiveRootChoice, "doctor" | "cancel">;
type InteractiveSubmenuChoice = InteractiveActionKey | "back" | "cancel";

type InteractiveMenuChoice<T extends string> = {
  name: string;
  value: T;
  description?: string;
};

type InteractiveSubmenuConfig = {
  message: string;
  choices: Array<InteractiveMenuChoice<InteractiveActionKey>>;
};

const INTERACTIVE_ROOT_CHOICES: Array<InteractiveMenuChoice<InteractiveRootChoice>> = [
  { name: "doctor", value: "doctor", description: "Check dependencies and capabilities" },
  { name: "data", value: "data", description: "Preview and convert tabular data" },
  { name: "md", value: "md", description: "Markdown utilities" },
  { name: "rename", value: "rename", description: "File/batch rename workflows" },
  { name: "video", value: "video", description: "Video conversion tools" },
  { name: "cancel", value: "cancel" },
];

const INTERACTIVE_SUBMENUS: Record<InteractiveSubmenuGroup, InteractiveSubmenuConfig> = {
  data: {
    message: "Choose a data command",
    choices: [
      { name: "preview", value: "data:preview" },
      { name: "query", value: "data:query" },
      { name: "parquet preview", value: "data:parquet-preview" },
      { name: "convert", value: "data:convert" },
    ],
  },
  md: {
    message: "Choose a markdown command",
    choices: [
      { name: "to-docx", value: "md:to-docx" },
      { name: "frontmatter-to-json", value: "md:frontmatter-to-json" },
    ],
  },
  rename: {
    message: "Choose a rename command",
    choices: [
      { name: "file", value: "rename:file" },
      { name: "batch", value: "rename:batch" },
      { name: "cleanup", value: "rename:cleanup" },
      { name: "apply", value: "rename:apply" },
    ],
  },
  video: {
    message: "Choose a video command",
    choices: [
      { name: "convert", value: "video:convert" },
      { name: "resize", value: "video:resize" },
      { name: "gif", value: "video:gif" },
    ],
  },
};

export async function selectInteractiveAction(): Promise<InteractiveActionKey | "cancel"> {
  while (true) {
    const rootChoice = await select<InteractiveRootChoice>({
      message: "Choose a command",
      choices: INTERACTIVE_ROOT_CHOICES,
    });

    if (rootChoice === "cancel") {
      return "cancel";
    }

    if (rootChoice === "doctor") {
      return "doctor";
    }

    const submenu = INTERACTIVE_SUBMENUS[rootChoice];
    const submenuChoice = await select<InteractiveSubmenuChoice>({
      message: submenu.message,
      choices: [
        ...submenu.choices,
        { name: "Back", value: "back", description: "Return to the main command menu" },
        { name: "Cancel", value: "cancel", description: "Exit interactive mode" },
      ],
    });

    if (submenuChoice === "back") {
      continue;
    }

    if (submenuChoice === "cancel") {
      return "cancel";
    }

    return submenuChoice;
  }
}
