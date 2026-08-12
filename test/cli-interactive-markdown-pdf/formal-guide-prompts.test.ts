import { beforeEach, describe, expect, mock, test } from "bun:test";

interface PromptChoice {
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
  confirms: Map<string, boolean[]>;
  defaults: Map<string, unknown[]>;
  inputs: Map<string, string[]>;
  rejected: Map<string, Array<{ error: string; value: string }>>;
  selects: Map<string, unknown[]>;
}

function createPromptState(): PromptState {
  return {
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
    const defaults = state.defaults.get(options.message) ?? [];
    defaults.push(options.default);
    state.defaults.set(options.message, defaults);
    return shift(state.confirms, options.message);
  },
  async input(options: InputOptions): Promise<string> {
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

function rejectedValues(message: string): string[] {
  return (state.rejected.get(message) ?? []).map(({ value }) => value);
}

describe("interactive Markdown PDF formal-guide prompt adapter", () => {
  test("converts page-number inputs and preserves a retained start of zero", async () => {
    queue(state.selects, "Count page numbers from", "body");
    queue(state.inputs, "First page number", "0");
    queue(state.inputs, "Page-number increment", "2");
    queue(state.selects, "Page-number position", "top-left");
    queue(state.inputs, "Page-number label template", "Page {page}");

    const result = await createMarkdownPdfFormalGuidePrompts().pageNumberDetails({
      countFromChoices: ["document", "body"],
      current: {
        countFrom: "body",
        format: "{page}",
        increment: 1,
        position: "bottom-center",
        start: 0,
      },
      scope: "body",
    });

    expect(result).toEqual({
      countFrom: "body",
      format: "Page {page}",
      increment: 2,
      position: "top-left",
      start: 0,
    });
    expect(state.defaults.get("First page number")).toEqual(["0"]);
    expect(typeof result.start).toBe("number");
    expect(typeof result.increment).toBe("number");
  });

  test("rejects blank, negative, decimal, and below-minimum numbering inputs", async () => {
    queue(state.selects, "Count page numbers from", "document");
    queue(state.inputs, "First page number", "", "-1", "1.5", "0");
    queue(state.inputs, "Page-number increment", "", "-1", "1.5", "0", "1");
    queue(state.selects, "Page-number position", "bottom-right");
    queue(state.inputs, "Page-number label template", "{page}");

    const result = await createMarkdownPdfFormalGuidePrompts().pageNumberDetails({
      countFromChoices: ["document"],
      scope: "document",
    });

    expect(result.start).toBe(0);
    expect(result.increment).toBe(1);
    expect(rejectedValues("First page number")).toEqual(["", "-1", "1.5"]);
    expect(rejectedValues("Page-number increment")).toEqual(["", "-1", "1.5", "0"]);
    expect(state.rejected.get("First page number")?.[0]?.error).toContain("integer of at least 0");
    expect(state.rejected.get("Page-number increment")?.[0]?.error).toContain(
      "integer of at least 1",
    );
  });

  test("rejects invalid page-chrome values and accepts every lower endpoint", async () => {
    queue(state.inputs, "Header left", "{company}");
    queue(state.inputs, "Header center", "");
    queue(state.inputs, "Header right", "{title}");
    queue(state.confirms, "Configure header style?", true);
    queue(state.inputs, "Header font size", "5.9pt", "6pt");
    queue(state.selects, "Header font weight", 400);
    queue(state.inputs, "Header line height", "", "0.9", "1");
    queue(state.inputs, "Header color", "#fff", "#000000");
    queue(state.confirms, "Add a header separator?", true);
    queue(state.inputs, "Header separator width", "0.24pt", "0.25pt");
    queue(state.selects, "Header separator style", "solid");
    queue(state.inputs, "Header separator color", "black", "#ffffff");
    queue(state.inputs, "Header separator gap", "-0.1mm", "0");

    const result = await createMarkdownPdfFormalGuidePrompts().pageChromeArea({ area: "header" });

    expect(result).toEqual({
      left: "{company}",
      center: "",
      right: "{title}",
      style: {
        fontSize: "6pt",
        fontWeight: 400,
        lineHeight: 1,
        color: "#000000",
        separator: {
          width: "0.25pt",
          style: "solid",
          color: "#ffffff",
          gap: 0,
        },
      },
    });
    expect(rejectedValues("Header font size")).toEqual(["5.9pt"]);
    expect(rejectedValues("Header line height")).toEqual(["", "0.9"]);
    expect(rejectedValues("Header color")).toEqual(["#fff"]);
    expect(rejectedValues("Header separator width")).toEqual(["0.24pt"]);
    expect(rejectedValues("Header separator color")).toEqual(["black"]);
    expect(rejectedValues("Header separator gap")).toEqual(["-0.1mm"]);
  });

  test("rejects values above page-chrome bounds and accepts every upper endpoint", async () => {
    queue(state.inputs, "Footer left", "{author}");
    queue(state.inputs, "Footer center", "");
    queue(state.inputs, "Footer right", "{date}");
    queue(state.confirms, "Configure footer style?", true);
    queue(state.inputs, "Footer font size", "12.1pt", "12pt");
    queue(state.selects, "Footer font weight", 700);
    queue(state.inputs, "Footer line height", "2.1", "2");
    queue(state.inputs, "Footer color", "#gggggg", "#ffffff");
    queue(state.confirms, "Add a footer separator?", true);
    queue(state.inputs, "Footer separator width", "2.01pt", "2pt");
    queue(state.selects, "Footer separator style", "solid");
    queue(state.inputs, "Footer separator color", "#12345", "#000000");
    queue(state.inputs, "Footer separator gap", "4.1mm", "4mm");

    const result = await createMarkdownPdfFormalGuidePrompts().pageChromeArea({ area: "footer" });

    expect(result.style).toEqual({
      fontSize: "12pt",
      fontWeight: 700,
      lineHeight: 2,
      color: "#ffffff",
      separator: {
        width: "2pt",
        style: "solid",
        color: "#000000",
        gap: "4mm",
      },
    });
    expect(rejectedValues("Footer font size")).toEqual(["12.1pt"]);
    expect(rejectedValues("Footer line height")).toEqual(["2.1"]);
    expect(rejectedValues("Footer color")).toEqual(["#gggggg"]);
    expect(rejectedValues("Footer separator width")).toEqual(["2.01pt"]);
    expect(rejectedValues("Footer separator color")).toEqual(["#12345"]);
    expect(rejectedValues("Footer separator gap")).toEqual(["4.1mm"]);
  });
});
