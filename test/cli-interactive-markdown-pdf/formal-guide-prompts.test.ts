import { beforeEach, describe, expect, mock, test } from "bun:test";

interface PromptChoice {
  checked?: boolean;
  description?: string;
  disabled?: boolean | string;
  name?: string;
  value: unknown;
}

interface InputOptions {
  message: string;
  default?: string;
  validate?: (value: string) => boolean | string | Promise<boolean | string>;
}

interface GhostPromptOptions extends InputOptions {
  completionKind?: string;
  ghostHintLabel?: string;
  ghostText: string;
  helpLines?: string[];
  initialValue?: string;
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

type CheckboxOptions = SelectOptions;

interface PromptState {
  calls: string[];
  choices: Map<string, PromptChoice[]>;
  checkboxes: Map<string, unknown[][]>;
  confirms: Map<string, boolean[]>;
  defaults: Map<string, unknown[]>;
  ghostPrompts: Map<string, GhostPromptOptions[]>;
  inputs: Map<string, string[]>;
  rejected: Map<string, Array<{ error: string; value: string }>>;
  selects: Map<string, unknown[]>;
}

function createPromptState(): PromptState {
  return {
    calls: [],
    choices: new Map(),
    checkboxes: new Map(),
    confirms: new Map(),
    defaults: new Map(),
    ghostPrompts: new Map(),
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
  async checkbox(options: CheckboxOptions): Promise<unknown[]> {
    state.calls.push(`checkbox:${options.message}`);
    state.choices.set(options.message, options.choices);
    const value = shift(state.checkboxes, options.message);
    if (!value.every((item) => options.choices.some((choice) => choice.value === item))) {
      throw new Error(`Mocked checkbox value is not offered for ${options.message}`);
    }
    return value;
  },
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

mock.module("../../src/cli/prompts/text-inline", () => ({
  async promptTextWithGhost(options: GhostPromptOptions): Promise<string> {
    state.calls.push(`ghost:${options.message}`);
    const prompts = state.ghostPrompts.get(options.message) ?? [];
    prompts.push(options);
    state.ghostPrompts.set(options.message, prompts);
    const defaults = state.defaults.get(options.message) ?? [];
    defaults.push(options.initialValue);
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

  test("maps recommended and compact page-number label choices", async () => {
    queue(state.selects, "Page-number label", "page", "compact");

    await expect(createMarkdownPdfFormalGuidePrompts().pageNumberLabel({})).resolves.toBe(
      "Page {page}",
    );
    await expect(
      createMarkdownPdfFormalGuidePrompts().pageNumberLabel({ current: "{page}" }),
    ).resolves.toBe("{page}");
    expect(state.defaults.get("Page-number label")).toEqual(["page", "compact"]);
    expect(state.choices.get("Page-number label")).toEqual([
      { name: "Page 1", value: "page", description: "Recommended" },
      { name: "1", value: "compact", description: "Compact" },
      { name: "Custom...", value: "custom", description: "Use page-label placeholders" },
    ]);
  });

  test("validates custom page-number labels and preserves a revision initial value", async () => {
    queue(state.selects, "Page-number label", "custom");
    queue(
      state.inputs,
      "Custom page-number label",
      "",
      "Total {pages}",
      "Total {pdfPages}",
      "PDF {pdfPage} of {pdfPages}",
    );

    const result = await createMarkdownPdfFormalGuidePrompts().pageNumberLabel({
      current: "{company} - Page {page}",
    });

    expect(result).toBe("PDF {pdfPage} of {pdfPages}");
    expect(state.defaults.get("Custom page-number label")).toEqual(["{company} - Page {page}"]);
    expect(state.rejected.get("Custom page-number label")).toEqual([
      {
        error: "Page-number label is required",
        value: "",
      },
      {
        error: "Page-number label must include the {page} or {pdfPage} placeholder",
        value: "Total {pages}",
      },
      {
        error: "Page-number label must include the {page} or {pdfPage} placeholder",
        value: "Total {pdfPages}",
      },
    ]);
    expect(state.ghostPrompts.get("Custom page-number label")?.[0]).toMatchObject({
      completionKind: "markdown-pdf-page-label",
      ghostHintLabel: "Page-number label suggestion (Right arrow to accept)",
      ghostText: "Page {page} of {pages}",
      helpLines: [
        "{page}: current logical page number",
        "{pages}: final logical page number in the selected countFrom domain",
        "{pdfPage}: current physical PDF page",
        "{pdfPages}: total physical PDF pages",
        "Literal text, punctuation, and digits are allowed; a literal total can become stale.",
      ],
      initialValue: "{company} - Page {page}",
    });
  });

  test("preserves a revised physical custom label as the editable initial value", async () => {
    const physicalLabel = "PDF {pdfPage} of {pdfPages}";
    queue(state.selects, "Page-number label", "custom");
    queue(state.inputs, "Custom page-number label", physicalLabel);

    await expect(
      createMarkdownPdfFormalGuidePrompts().pageNumberLabel({ current: physicalLabel }),
    ).resolves.toBe(physicalLabel);
    expect(state.defaults.get("Custom page-number label")).toEqual([physicalLabel]);
    expect(state.ghostPrompts.get("Custom page-number label")?.[0]?.initialValue).toBe(
      physicalLabel,
    );
  });

  test("passes the fresh custom page-label ghost contract without an initial value", async () => {
    queue(state.selects, "Page-number label", "custom");
    queue(state.inputs, "Custom page-number label", "Page {page}/{pages}");

    await expect(createMarkdownPdfFormalGuidePrompts().pageNumberLabel({})).resolves.toBe(
      "Page {page}/{pages}",
    );
    const prompt = state.ghostPrompts.get("Custom page-number label")?.[0];
    expect(prompt).toMatchObject({
      completionKind: "markdown-pdf-page-label",
      ghostText: "Page {page} of {pages}",
      helpLines: [
        "{page}: current logical page number",
        "{pages}: final logical page number in the selected countFrom domain",
        "{pdfPage}: current physical PDF page",
        "{pdfPages}: total physical PDF pages",
        "Literal text, punctuation, and digits are allowed; a literal total can become stale.",
      ],
    });
    expect(prompt?.initialValue).toBeUndefined();
  });

  test("selects repeating-content positions from only the available layout", async () => {
    const message = "Repeating-content positions (page number uses footer center)";
    queue(state.checkboxes, message, ["top-left", "bottom-right"]);
    const result = await createMarkdownPdfFormalGuidePrompts().repeatingContentPositions({
      available: ["top-left", "top-center", "top-right", "bottom-left", "bottom-right"],
      current: ["bottom-left"],
      reserved: "bottom-center",
    });

    expect(result).toEqual(["top-left", "bottom-right"]);
    expect(state.choices.get(message)).toEqual([
      { name: "Header left", value: "top-left", checked: false },
      { name: "Header center", value: "top-center", checked: false },
      { name: "Header right", value: "top-right", checked: false },
      { name: "Footer left", value: "bottom-left", checked: true },
      {
        name: "Footer center - Page number",
        value: "bottom-center",
        disabled: "Page-number position",
      },
      { name: "Footer right", value: "bottom-right", checked: false },
    ]);
  });

  test("renders all six enabled repeating-content choices when no position is reserved", async () => {
    queue(state.checkboxes, "Repeating-content positions", []);

    await expect(
      createMarkdownPdfFormalGuidePrompts().repeatingContentPositions({
        available: [
          "top-left",
          "top-center",
          "top-right",
          "bottom-left",
          "bottom-center",
          "bottom-right",
        ],
      }),
    ).resolves.toEqual([]);
    const choices = state.choices.get("Repeating-content positions");
    expect(choices).toEqual([
      { name: "Header left", value: "top-left", checked: false },
      { name: "Header center", value: "top-center", checked: false },
      { name: "Header right", value: "top-right", checked: false },
      { name: "Footer left", value: "bottom-left", checked: false },
      { name: "Footer center", value: "bottom-center", checked: false },
      { name: "Footer right", value: "bottom-right", checked: false },
    ]);
    expect(choices?.every((choice) => choice.disabled === undefined)).toBe(true);
  });

  test("uses slot-aware repeating-content input and an explicit conflict-clear default", async () => {
    queue(state.inputs, "Footer left content", "", "{author}");
    queue(
      state.confirms,
      "Clear existing footer center content that conflicts with page numbering?",
      false,
    );

    await expect(
      createMarkdownPdfFormalGuidePrompts().repeatingContent({ position: "bottom-left" }),
    ).resolves.toBe("{author}");
    await expect(
      createMarkdownPdfFormalGuidePrompts().clearOccupiedPageNumberPosition({
        current: "Existing",
        position: "bottom-center",
      }),
    ).resolves.toBe(false);
    expect(state.rejected.get("Footer left content")).toEqual([
      { error: "Repeating content is required", value: "" },
    ]);
    expect(state.ghostPrompts.get("Footer left content")?.[0]).toMatchObject({
      completionKind: "markdown-pdf-repeating-content",
      ghostHintLabel: "Content suggestion (Right arrow to accept)",
      ghostText: "{author}",
      helpLines: [
        "Placeholders: {title}, {company}, {author}, {date}",
        "Values resolve from CLI metadata, Markdown frontmatter, then Profile metadata.",
        "Unknown or missing placeholders render as empty text; literal text is also valid.",
      ],
    });
    expect(
      state.defaults.get(
        "Clear existing footer center content that conflicts with page numbering?",
      ),
    ).toEqual([false]);
  });

  test("passes revised repeating content as the editable ghost-prompt initial value", async () => {
    queue(state.inputs, "Header center content", "{company}");

    await expect(
      createMarkdownPdfFormalGuidePrompts().repeatingContent({
        current: "Acme {company}",
        position: "top-center",
      }),
    ).resolves.toBe("{company}");
    expect(state.ghostPrompts.get("Header center content")?.[0]).toMatchObject({
      completionKind: "markdown-pdf-repeating-content",
      ghostText: "{company}",
      helpLines: [
        "Placeholders: {title}, {company}, {author}, {date}",
        "Values resolve from CLI metadata, Markdown frontmatter, then Profile metadata.",
        "Unknown or missing placeholders render as empty text; literal text is also valid.",
      ],
      initialValue: "Acme {company}",
    });
  });
});
