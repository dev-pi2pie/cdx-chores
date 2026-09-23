import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createHarnessRuntime } from "../../cli-foundations/interactive-harness/runtime";
import type { CliRuntime } from "../../../src/cli/types";
import type { InteractivePathPromptContext } from "../../../src/cli/interactive/shared";
import type { MarkdownPdfInteractiveFontHintEditorSession } from "../../../src/cli/interactive/markdown/font-hints";
import type {
  MarkdownPdfCodexPageInformationAction,
  MarkdownPdfCodexPageInformationPrompts,
} from "../../../src/cli/interactive/markdown/codex-page-information";
import { normalizeMarkdownPdfProfile } from "../../../src/cli/markdown-pdf/profile";
import type { MarkdownPdfPageChromePosition } from "../../../src/cli/markdown-pdf/profile";

let selectQueue: string[] = [];
let pathQueue: string[] = [];
let calls: string[] = [];

mock.module("@inquirer/prompts", () => ({
  async select(options: { message: string; choices: Array<{ value: string }> }) {
    calls.push(`select:${options.message}`);
    const value = selectQueue.shift();
    if (!value || !options.choices.some((choice) => choice.value === value)) {
      throw new Error(`Unexpected selection at ${options.message}: ${value}`);
    }
    return value;
  },
  async confirm(options: { message: string }) {
    calls.push(`confirm:${options.message}`);
    return options.message === "Enable reusable page numbers in this Profile?";
  },
  async input(options: { message: string }) {
    calls.push(`input:${options.message}`);
    return "";
  },
  async editor() {
    throw new Error("Editor was not selected");
  },
  async checkbox() {
    throw new Error("Checkbox was not selected");
  },
}));

mock.module("../../../src/cli/prompts/path", () => ({
  async promptRequiredPathWithConfig(message: string) {
    calls.push(`path:${message}`);
    const path = pathQueue.shift();
    if (!path) throw new Error(`Unexpected path prompt: ${message}`);
    return path;
  },
}));

const { collectMarkdownPdfCodexSetup } =
  await import("../../../src/cli/interactive/markdown/codex-setup");

beforeEach(() => {
  selectQueue = [];
  pathQueue = [];
  calls = [];
});

function pagePrompts(
  actions: MarkdownPdfCodexPageInformationAction[],
  options: {
    repeatingEnabled: boolean;
    selected?: (
      current: readonly MarkdownPdfPageChromePosition[] | undefined,
    ) => readonly MarkdownPdfPageChromePosition[];
    text?: string;
  },
): MarkdownPdfCodexPageInformationPrompts {
  return {
    initial: async () => "edit",
    action: async () => {
      const action = actions.shift();
      if (!action) throw new Error("Unexpected page-information revision");
      return action;
    },
    conflict: async () => {
      throw new Error("Unexpected explicit slot conflict");
    },
    formalGuide: {
      pageNumbersEnabled: () => false,
      pageNumberOutcome: () => "body",
      pageNumberLabel: () => "Page {page}",
      pageNumberPosition: () => "bottom-center",
      repeatingContentEnabled: () => options.repeatingEnabled,
      repeatingContentPositions: ({ current }) => options.selected?.(current) ?? current ?? [],
      repeatingContent: ({ current }) => current ?? options.text ?? "Authored",
      clearOccupiedPageNumberPosition: () => {
        throw new Error("Unexpected occupied-slot prompt");
      },
    },
  };
}

function context() {
  const { runtime } = createHarnessRuntime();
  return {
    runtime: runtime as unknown as CliRuntime,
    pathPromptContext: {
      cwd: runtime.cwd,
      stdin: runtime.stdin,
      stdout: runtime.stdout,
      runtimeConfig: {
        mode: "simple",
        autocomplete: { enabled: false, minChars: 1, maxSuggestions: 10, includeHidden: false },
      },
    } as unknown as InteractivePathPromptContext,
    fontHintEditor: {
      cancel: () => {},
      edit: async () => [],
    } as MarkdownPdfInteractiveFontHintEditorSession,
  };
}

describe("internal Markdown PDF Codex setup entry", () => {
  test("asks for page information after the sample and before PDF intent", async () => {
    selectQueue = [
      "none",
      "edit",
      "numbers",
      "body",
      "page",
      "bottom-center",
      "continue",
      "continue",
    ];
    const { runtime, pathPromptContext, fontHintEditor } = context();
    const result = await collectMarkdownPdfCodexSetup(runtime, pathPromptContext, {
      artifact: "profile",
      entry: "pdf-recipes",
      fontHintEditor,
      internalPageInformation: {},
    });
    expect(result.kind).toBe("setup");
    if (result.kind !== "setup") return;
    expect(result.setup.pageInformation?.pageNumbers?.enabled).toBe(true);
    expect(calls).toEqual([
      "select:Markdown preparation sample",
      "select:Specify page information in this Profile?",
      "select:Page information setup",
      "confirm:Enable reusable page numbers in this Profile?",
      "select:Number which pages?",
      "select:Page-number label",
      "select:Page-number position",
      "select:Page information setup",
      "confirm:Use multiline editor?",
      "input:PDF intent (optional)\n ",
      "select:Profile setup next step",
    ]);
  });

  test("keeps the normal and Template setup routes unchanged", async () => {
    for (const [artifact, internal] of [
      ["profile", false],
      ["template-bundle", true],
    ] as const) {
      calls = [];
      selectQueue = ["none", "continue"];
      const { runtime, pathPromptContext, fontHintEditor } = context();
      const result = await collectMarkdownPdfCodexSetup(runtime, pathPromptContext, {
        artifact,
        entry: "pdf-recipes",
        fontHintEditor,
        ...(internal ? { internalPageInformation: {} } : {}),
      });
      expect(result.kind).toBe("setup");
      expect(calls).not.toContain("select:Specify page information in this Profile?");
      expect(calls).toEqual([
        "select:Markdown preparation sample",
        "confirm:Use multiline editor?",
        "input:PDF intent (optional)\n ",
        `select:${artifact === "profile" ? "Profile" : "Template bundle"} setup next step`,
      ]);
    }
  });

  test("uses Profile wording for the contained Project Profile", async () => {
    selectQueue = ["none", "skip", "continue"];
    const { runtime, pathPromptContext, fontHintEditor } = context();
    const result = await collectMarkdownPdfCodexSetup(runtime, pathPromptContext, {
      artifact: "project-bundle",
      entry: "pdf-recipes",
      fontHintEditor,
      internalPageInformation: {},
    });
    expect(result.kind).toBe("setup");
    expect(calls).toContain("select:Specify page information in this Profile?");
    expect(calls).not.toContain("select:Page information setup");
  });

  test("preserves ON selections through later base selection, replacement, revision, and clearing", async () => {
    selectQueue = [
      "none",
      "base-profile",
      "base-profile",
      "page-information",
      "clear-base-profile",
      "continue",
    ];
    pathQueue = ["base-a.yml", "base-b.yml"];
    const selectedAtPrompt: Array<readonly MarkdownPdfPageChromePosition[] | undefined> = [];
    const actions: MarkdownPdfCodexPageInformationAction[] = [
      "repeating",
      "continue", // first edit, before a base exists
      "continue", // base A recheck
      "continue", // base B recheck
      "repeating",
      "continue", // explicit revision with base B
      "continue", // base clear recheck
    ];
    const prompts = pagePrompts(actions, {
      repeatingEnabled: true,
      selected: (current) => {
        selectedAtPrompt.push(current);
        return current?.length ? current : ["top-left"];
      },
    });
    const bases = {
      "base-a.yml": normalizeMarkdownPdfProfile({
        profile: { header: { left: "A left", right: "A right" } },
      }).profile,
      "base-b.yml": normalizeMarkdownPdfProfile({
        profile: { header: { left: "B left", center: "B center" }, footer: { right: "B right" } },
      }).profile,
    };
    const loadCalls: string[] = [];
    const { runtime, pathPromptContext, fontHintEditor } = context();
    const result = await collectMarkdownPdfCodexSetup(runtime, pathPromptContext, {
      artifact: "profile",
      entry: "pdf-recipes",
      fontHintEditor,
      internalPageInformation: {
        prompts,
        loadBase: async (path) => {
          loadCalls.push(path);
          const base = bases[path as keyof typeof bases];
          if (!base) throw new Error(`Unknown base: ${path}`);
          return base;
        },
      },
    });
    expect(result.kind).toBe("setup");
    if (result.kind !== "setup") return;
    expect(actions).toEqual([]);
    expect(pathQueue).toEqual([]);
    expect(loadCalls).toEqual(["base-a.yml", "base-b.yml", "base-b.yml"]);
    expect(selectedAtPrompt).toEqual([[], ["top-left"]]);
    expect(result.setup.baseProfile).toBeUndefined();
    expect(result.setup.pageInformation?.repeatingContent).toEqual({
      enabled: true,
      selected: ["top-left"],
      text: { "top-left": "Authored" },
    });
  });

  test("keeps explicit repeating OFF through later base selection, replacement, and clearing", async () => {
    selectQueue = ["none", "base-profile", "base-profile", "clear-base-profile", "continue"];
    pathQueue = ["base-a.yml", "base-b.yml"];
    const actions: MarkdownPdfCodexPageInformationAction[] = [
      "repeating",
      "continue", // first edit
      "continue", // base selection recheck
      "continue", // base replacement recheck
      "continue", // base clear recheck
    ];
    const prompts = pagePrompts(actions, { repeatingEnabled: false });
    const base = normalizeMarkdownPdfProfile({
      profile: {
        pageNumbers: { enabled: true, position: "bottom-center" },
        header: { left: "Inherited header" },
        footer: { center: "Occupied number slot" },
      },
    }).profile;
    const loadCalls: string[] = [];
    const { runtime, pathPromptContext, fontHintEditor } = context();
    const result = await collectMarkdownPdfCodexSetup(runtime, pathPromptContext, {
      artifact: "project-bundle",
      entry: "pdf-recipes",
      fontHintEditor,
      internalPageInformation: {
        prompts,
        loadBase: async (path) => {
          loadCalls.push(path);
          return base;
        },
      },
    });
    expect(result.kind).toBe("setup");
    if (result.kind !== "setup") return;
    expect(actions).toEqual([]);
    expect(loadCalls).toEqual(["base-a.yml", "base-b.yml"]);
    expect(result.setup.baseProfile).toBeUndefined();
    expect(result.setup.pageInformation?.repeatingContent).toEqual({
      enabled: false,
      selected: [],
      text: {},
    });
    expect(result.setup.pageInformation?.occupiedNumberSlot).toBeUndefined();
  });
});
