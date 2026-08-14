import { beforeEach, describe, expect, mock, test } from "bun:test";

interface PromptChoice {
  name?: string;
  value: unknown;
}

interface InputOptions {
  message: string;
  default?: string;
  validate?: (value: string) => boolean | string | Promise<boolean | string>;
}

interface SelectOptions {
  message: string;
  choices: PromptChoice[];
  default?: unknown;
}

interface ConfirmOptions {
  message: string;
  default?: boolean;
}

interface PromptState {
  calls: string[];
  choices: Map<string, PromptChoice[]>;
  confirms: Map<string, boolean[]>;
  defaults: Map<string, unknown[]>;
  inputs: Map<string, string[]>;
  rejected: Map<string, Array<{ error: string; value: string }>>;
  selects: Map<string, unknown[]>;
}

function createPromptState(): PromptState {
  return {
    calls: [],
    choices: new Map(),
    confirms: new Map(),
    defaults: new Map(),
    inputs: new Map(),
    rejected: new Map(),
    selects: new Map(),
  };
}

let state = createPromptState();

function queue<T>(values: Map<string, T[]>, message: string, ...items: T[]): void {
  values.set(message, items);
}

function shift<T>(values: Map<string, T[]>, message: string): T {
  const queued = values.get(message);
  if (!queued || queued.length === 0) {
    throw new Error(`No mocked prompt value for: ${message}`);
  }
  return queued.shift() as T;
}

mock.module("@inquirer/prompts", () => ({
  async confirm(options: ConfirmOptions): Promise<boolean> {
    state.calls.push(`confirm:${options.message}`);
    const defaults = state.defaults.get(options.message) ?? [];
    defaults.push(options.default);
    state.defaults.set(options.message, defaults);
    return shift(state.confirms, options.message);
  },
  async input(options: InputOptions): Promise<string> {
    state.calls.push(`input:${options.message}`);
    const defaults = state.defaults.get(options.message) ?? [];
    defaults.push(options.default);
    state.defaults.set(options.message, defaults);
    while (true) {
      const value = shift(state.inputs, options.message);
      const validation = options.validate ? await options.validate(value) : true;
      if (validation === true) {
        return value;
      }
      const rejected = state.rejected.get(options.message) ?? [];
      rejected.push({ error: String(validation), value });
      state.rejected.set(options.message, rejected);
    }
  },
  async select(options: SelectOptions): Promise<unknown> {
    state.calls.push(`select:${options.message}`);
    state.choices.set(options.message, options.choices);
    const defaults = state.defaults.get(options.message) ?? [];
    defaults.push(options.default);
    state.defaults.set(options.message, defaults);
    const value = shift(state.selects, options.message);
    if (!options.choices.some((choice) => choice.value === value)) {
      throw new Error(`Mocked selection is not offered for ${options.message}: ${String(value)}`);
    }
    return value;
  },
}));

const { createMarkdownPdfFormalGuidePrompts } =
  await import("../../src/cli/interactive/markdown/formal-guide/prompts");

beforeEach(() => {
  state = createPromptState();
});

describe("interactive Markdown PDF formal-guide prompt adapter", () => {
  test("offers the two guided numbering outcomes with body as the fresh default", async () => {
    queue(state.selects, "Number which pages?", "body");

    await expect(createMarkdownPdfFormalGuidePrompts().pageNumberOutcome({})).resolves.toBe("body");
    expect(state.defaults.get("Number which pages?")).toEqual(["body"]);
    expect(state.choices.get("Number which pages?")).toEqual([
      { name: "Body pages, starting at 1", value: "body" },
      { name: "Entire document, starting at 1", value: "document" },
    ]);
  });

  test("offers all six page-number positions with human-readable labels", async () => {
    queue(state.selects, "Page-number position", "top-left");

    await expect(
      createMarkdownPdfFormalGuidePrompts().pageNumberPosition({ current: "bottom-right" }),
    ).resolves.toBe("top-left");
    expect(state.defaults.get("Page-number position")).toEqual(["bottom-right"]);
    expect(state.choices.get("Page-number position")).toEqual([
      { name: "Bottom center", value: "bottom-center" },
      { name: "Bottom right", value: "bottom-right" },
      { name: "Bottom left", value: "bottom-left" },
      { name: "Top center", value: "top-center" },
      { name: "Top right", value: "top-right" },
      { name: "Top left", value: "top-left" },
    ]);
  });

  test("offers one concise page-chrome gate", async () => {
    queue(state.selects, "Add repeating header or footer text?", "both");

    await expect(
      createMarkdownPdfFormalGuidePrompts().pageChromeSelection({ current: "header" }),
    ).resolves.toBe("both");
    expect(state.defaults.get("Add repeating header or footer text?")).toEqual(["header"]);
    expect(state.choices.get("Add repeating header or footer text?")).toEqual([
      { name: "No", value: "none" },
      { name: "Header", value: "header" },
      { name: "Footer", value: "footer" },
      { name: "Both", value: "both" },
    ]);
  });

  test("prompts only selected page-chrome slots and preserves retained style", async () => {
    queue(state.inputs, "Header left", "{company}");
    queue(state.inputs, "Header right", "{title}");
    const style = { fontSize: "8pt", separator: { width: "0.5pt" } } as const;

    const result = await createMarkdownPdfFormalGuidePrompts().pageChromeArea({
      area: "header",
      current: { left: "Old", center: "Owned", right: "Old", style },
      slots: ["left", "right"],
    });

    expect(result).toEqual({
      left: "{company}",
      center: "Owned",
      right: "{title}",
      style,
    });
    expect(state.calls).toEqual(["input:Header left", "input:Header right"]);
  });

  test("prompts every page-chrome slot when all are available", async () => {
    queue(state.inputs, "Footer left", "{author}");
    queue(state.inputs, "Footer center", "");
    queue(state.inputs, "Footer right", "{date}");
    const result = await createMarkdownPdfFormalGuidePrompts().pageChromeArea({
      area: "footer",
      slots: ["left", "center", "right"],
    });

    expect(result).toEqual({ left: "{author}", center: "", right: "{date}" });
    expect(state.calls).toEqual(["input:Footer left", "input:Footer center", "input:Footer right"]);
  });
});
