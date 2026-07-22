import { describe, expect, test } from "bun:test";
import type { input } from "@inquirer/prompts";
import search from "@inquirer/search";
import { PassThrough } from "node:stream";

import {
  buildMarkdownPdfInteractiveFontHintPreferenceChoices,
  collectInstalledFontFamilies,
  compileMarkdownPdfInteractiveFontHintDraft,
  createMarkdownPdfInteractiveFontHintSuggestionService,
  filterInstalledFontFamilies,
  findExactMarkdownPdfInteractiveFontHintDuplicate,
  formatMarkdownPdfInteractiveFontHintPreview,
  intendedUseChoices,
  moveMarkdownPdfInteractiveFontHint,
} from "../../src/cli/interactive/markdown/font-hints";
import type { FontFace } from "../../src/fonts";
import { collectMarkdownPdfInteractiveFontReview } from "../../src/cli/interactive/markdown/font-review";
import type { PreparedMarkdownPdfCodexCandidate } from "../../src/cli/interactive/markdown/codex-types";
import { renderMarkdownPdfCodexCandidateReview } from "../../src/cli/interactive/markdown/codex-review";
import { createCapturedRuntime } from "../helpers/cli-test-utils";

function face(family: string, path = `/private/${family}.otf`): FontFace {
  return { family, fullName: family, path, source: "system", style: "normal" };
}

function discoveryResult(families: string[]) {
  return {
    adapter: "fontconfig",
    discovery: "fontconfig" as const,
    faces: families.map((family) => face(family)),
    warnings: [],
  };
}

class RealPromptInput extends PassThrough {
  isTTY = true;

  setRawMode(): this {
    return this;
  }
}

class NarrowPromptOutput extends PassThrough {
  isTTY = true;
  columns = 36;
}

async function promptTick(): Promise<void> {
  for (let index = 0; index < 3; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe("Markdown PDF Interactive font hint model", () => {
  test("compiles every supported intended-use family to one direct-equivalent string", () => {
    expect(compileMarkdownPdfInteractiveFontHintDraft({ kind: "built", preference: "Inter" })).toBe(
      "Prefer Inter",
    );
    expect(
      compileMarkdownPdfInteractiveFontHintDraft({
        kind: "built",
        preference: "Source Serif 4",
        intendedUse: { kind: "body" },
      }),
    ).toBe("Prefer Source Serif 4 for body text");
    expect(
      compileMarkdownPdfInteractiveFontHintDraft({
        kind: "built",
        preference: "Noto Serif JP",
        intendedUse: { kind: "language-body", language: "Japanese" },
      }),
    ).toBe("Prefer Noto Serif JP for Japanese body text");
    expect(
      compileMarkdownPdfInteractiveFontHintDraft({
        kind: "built",
        preference: "JetBrains Mono",
        intendedUse: { kind: "code-symbols" },
      }),
    ).toBe("Prefer JetBrains Mono for code symbols");
    expect(
      compileMarkdownPdfInteractiveFontHintDraft({
        kind: "built",
        preference: "Inter",
        intendedUse: { kind: "page-chrome" },
      }),
    ).toBe("Prefer Inter for page headers and footers");
    expect(
      compileMarkdownPdfInteractiveFontHintDraft({
        kind: "custom",
        text: "  Prefer Brand Sans for callout captions  ",
      }),
    ).toBe("Prefer Brand Sans for callout captions");
  });

  test("keeps page chrome out of Template intended uses", () => {
    expect(intendedUseChoices("template-bundle").map((choice) => choice.value.kind)).not.toContain(
      "page-chrome",
    );
    expect(intendedUseChoices("profile").map((choice) => choice.value.kind)).toContain(
      "page-chrome",
    );
  });

  test("renders intended use, direct option, and advisory assignment in preview", () => {
    expect(
      formatMarkdownPdfInteractiveFontHintPreview({
        kind: "built",
        preference: "Noto Serif JP",
        intendedUse: { kind: "language-body", language: "Japanese" },
      }),
    ).toEqual(
      expect.arrayContaining([
        "Intended use: Language-specific body text — Japanese",
        "--font-hint = Prefer Noto Serif JP for Japanese body text",
        "Assignment: determined during Codex preparation",
      ]),
    );
  });

  test("deduplicates families case-insensitively and filters a bounded stable page", () => {
    const families = collectInstalledFontFamilies([
      face("source serif 4"),
      face("Source Serif 4"),
      face("Inter"),
      face("Noto Sans"),
      face("Noto Serif"),
      face("Noto Mono"),
      face("Noto Color Emoji"),
      face("Noto Sans Symbols"),
      face("Noto Music"),
      face("Noto Nastaliq"),
    ]);

    expect(families.filter((family) => family.toLowerCase() === "source serif 4")).toEqual([
      "Source Serif 4",
    ]);
    expect(filterInstalledFontFamilies(families, "noto")).toEqual([
      "Noto Color Emoji",
      "Noto Mono",
      "Noto Music",
      "Noto Nastaliq",
      "Noto Sans",
      "Noto Sans Symbols",
    ]);
  });

  test("keeps raw custom text first and collapses an exact installed duplicate", () => {
    const choices = buildMarkdownPdfInteractiveFontHintPreferenceChoices({
      families: ["Source Serif 4", "Source Serif Pro"],
      term: "Source Serif 4",
    });

    expect(choices).toEqual([
      {
        name: "Source Serif 4",
        value: "Source Serif 4",
        description: "Use the typed text as a custom font preference.",
      },
    ]);
    expect(
      buildMarkdownPdfInteractiveFontHintPreferenceChoices({
        families: ["Source Serif 4"],
        term: "  Source",
      })[0],
    ).toEqual({
      name: "  Source",
      value: "  Source",
      description: "Use the typed text as a custom font preference.",
    });
  });

  test("detects only exact duplicates and preserves explicit collection ordering", () => {
    expect(
      findExactMarkdownPdfInteractiveFontHintDuplicate(
        ["Prefer Inter for headings and titles"],
        "prefer inter for headings and titles",
      ),
    ).toBe("Prefer Inter for headings and titles");
    expect(
      findExactMarkdownPdfInteractiveFontHintDuplicate(
        ["Prefer Inter for headings and titles"],
        "Prefer Source Serif 4 for headings and titles",
      ),
    ).toBeUndefined();
    expect(moveMarkdownPdfInteractiveFontHint(["one", "two", "three"], 2, 0)).toEqual([
      "three",
      "one",
      "two",
    ]);
  });
});

describe("Markdown PDF Interactive font hint suggestion service", () => {
  test("starts lazily, caches family-only inventory, and filters without rediscovery", async () => {
    const { runtime } = createCapturedRuntime();
    let discoveryCalls = 0;
    let visibleChoices = "";
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async (options) => {
        discoveryCalls += 1;
        expect(options?.discovery).toBe("fontconfig");
        expect(options?.timeoutMs).toBe(1_000);
        return {
          ...discoveryResult(["Source Serif 4", "Source Serif Pro"]),
          faces: [
            face("Source Serif 4", "/private/secret-source-serif.otf"),
            face("Source Serif Pro", "/private/secret-source-serif-pro.otf"),
          ],
        };
      },
      searchPrompt: (async (
        options: Parameters<typeof search>[0],
        context: Parameters<typeof search>[1],
      ) => {
        expect(options.pageSize).toBe(7);
        expect(context?.input).toBe(runtime.stdin);
        expect(context?.output).toBe(runtime.stderr);
        const choices = await options.source?.("Source", {
          signal: new AbortController().signal,
        });
        visibleChoices = JSON.stringify(choices);
        return "Source Serif 4";
      }) as typeof search,
    });

    expect(discoveryCalls).toBe(0);
    expect(await service.promptPreference()).toBe("Source Serif 4");
    expect(await service.promptPreference("Source Serif")).toBe("Source Serif 4");
    expect(discoveryCalls).toBe(1);
    expect(visibleChoices).not.toContain("/private/");
  });

  test("caches unavailable discovery while falling back to ordinary input each time", async () => {
    const { runtime, stderr } = createCapturedRuntime();
    let discoveryCalls = 0;
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async () => {
        discoveryCalls += 1;
        return discoveryResult([]);
      },
      inputPrompt: (async (options) =>
        options.default === "Brand Sans" ? "Inter" : "Brand Sans") as typeof input,
    });

    expect(await service.promptPreference()).toBe("Brand Sans");
    expect(await service.promptPreference("Brand Sans")).toBe("Inter");
    expect(discoveryCalls).toBe(1);
    expect(stderr.text.match(/Installed font suggestions are unavailable/g)).toHaveLength(1);
  });

  test("rejects discovery results that finish outside the total Interactive budget", async () => {
    const { runtime, stderr } = createCapturedRuntime();
    const timestamps = [0, 1_000];
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async () => discoveryResult(["Inter"]),
      inputPrompt: (async () => "Brand Sans") as typeof input,
      now: () => timestamps.shift() ?? 1_000,
    });

    expect(await service.promptPreference()).toBe("Brand Sans");
    expect(stderr.text).toContain("Installed font suggestions are unavailable");
  });

  test("returns at the overall deadline and aborts a late discovery", async () => {
    const { runtime } = createCapturedRuntime();
    let discoverySignal: AbortSignal | undefined;
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async (options) => {
        discoverySignal = options?.signal;
        return await new Promise(() => {});
      },
      discoveryTimeoutMs: 20,
      inputPrompt: (async () => "Brand Sans") as typeof input,
      scheduleDeadline: (callback) => {
        queueMicrotask(callback);
        return () => {};
      },
    });
    const startedAt = Date.now();

    expect(await service.promptPreference()).toBe("Brand Sans");
    expect(Date.now() - startedAt).toBeLessThan(500);
    expect(discoverySignal?.aborted).toBe(true);
  });

  test("shows and clears delayed TTY discovery status before search", async () => {
    const { runtime, stderr } = createCapturedRuntime();
    (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async () => {
        await new Promise((resolve) => setTimeout(resolve, 175));
        return discoveryResult(["Inter"]);
      },
      searchPrompt: (async () => {
        expect(stderr.text).toContain("Discovering installed font families...");
        expect(stderr.text).toContain("\u001b[1A\u001b[2K\u001b[G");
        return "Inter";
      }) as typeof search,
    });

    expect(await service.promptPreference()).toBe("Inter");
  });

  test("aborts active discovery silently without falling through to input", async () => {
    const { runtime, stderr } = createCapturedRuntime();
    let inputCalls = 0;
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async (options) =>
        await new Promise((resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        }),
      inputPrompt: (async () => {
        inputCalls += 1;
        return "should not run";
      }) as typeof input,
    });

    const pending = service.promptPreference();
    await Promise.resolve();
    service.cancel();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(inputCalls).toBe(0);
    expect(stderr.text).not.toContain("unavailable");
  });

  test("uses Escape as back navigation and aborts an active search on session cancellation", async () => {
    const { runtime } = createCapturedRuntime();
    runtime.stdin = new PassThrough() as unknown as NodeJS.ReadStream;
    let searchCalls = 0;
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async () => discoveryResult(["Inter"]),
      searchPrompt: ((
        _options: Parameters<typeof search>[0],
        context: Parameters<typeof search>[1],
      ) => {
        searchCalls += 1;
        return new Promise<string>((_resolve, reject) => {
          context?.signal?.addEventListener(
            "abort",
            () => {
              const error = new Error("Prompt was aborted", {
                cause: context.signal?.reason,
              });
              error.name = "AbortPromptError";
              reject(error);
            },
            { once: true },
          );
          if (searchCalls === 1) {
            runtime.stdin.emit("keypress", "", { name: "escape" });
          }
        });
      }) as typeof search,
    });

    expect(await service.promptPreference()).toBeUndefined();
    const pending = service.promptPreference();
    await promptTick();
    service.cancel();
    await expect(pending).rejects.toMatchObject({ name: "AbortPromptError" });
  });

  test("uses Escape as back navigation from unavailable-discovery text input", async () => {
    const { runtime } = createCapturedRuntime();
    runtime.stdin = new PassThrough() as unknown as NodeJS.ReadStream;
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async () => discoveryResult([]),
      inputPrompt: ((_options, context) =>
        new Promise<string>((_resolve, reject) => {
          context?.signal?.addEventListener(
            "abort",
            () => {
              const error = new Error("Prompt was aborted", { cause: context.signal?.reason });
              error.name = "AbortPromptError";
              reject(error);
            },
            { once: true },
          );
          runtime.stdin.emit("keypress", "", { name: "escape" });
        })) as typeof input,
    });

    expect(await service.promptPreference()).toBeUndefined();
  });

  test("keeps the pinned real search keyboard contract usable in a narrow terminal", async () => {
    const { runtime } = createCapturedRuntime();
    const stdin = new RealPromptInput();
    const stderr = new NarrowPromptOutput();
    runtime.stdin = stdin as unknown as NodeJS.ReadStream;
    runtime.stderr = stderr;
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async () => discoveryResult(["Source Code Pro", "Source Serif 4"]),
    });

    const custom = service.promptPreference();
    await promptTick();
    stdin.write("Source");
    await promptTick();
    stdin.write("\u001b[A");
    await promptTick();
    stdin.write("\r");
    await expect(custom).resolves.toBe("Source");

    const completed = service.promptPreference();
    await promptTick();
    stdin.write("Source");
    await promptTick();
    stdin.write("\u001b[B");
    await promptTick();
    stdin.write("\t");
    await promptTick();
    stdin.write("\r");
    await expect(completed).resolves.toBe("Source Code Pro");

    const unicodePaste = service.promptPreference();
    await promptTick();
    stdin.write("自訂字型");
    await promptTick();
    stdin.write("\r");
    await expect(unicodePaste).resolves.toBe("自訂字型");
  });
});

describe("Markdown PDF Interactive post-Codex font review", () => {
  test("collects Profile accepted mappings and unresolved directions", () => {
    const candidate = {
      artifact: "profile",
      setup: { artifact: "profile", fontHints: ["Prefer Noto Serif JP for Japanese body text"] },
      prepared: {
        kind: "profile",
        result: {
          decision: {
            acceptedFontPatches: [
              { op: "replace-font", role: "body", key: "ja", value: "Noto Serif JP" },
            ],
            unmatchedDirections: ["Keep emoji colorful"],
          },
        },
      },
    } as unknown as PreparedMarkdownPdfCodexCandidate;

    expect(collectMarkdownPdfInteractiveFontReview(candidate)).toEqual({
      applied: [{ family: "Noto Serif JP", key: "ja", layer: "Profile", role: "body" }],
      blocked: [],
      unresolved: ["Keep emoji colorful"],
    });
  });

  test("separates Template applied and blocked mappings", () => {
    const candidate = {
      artifact: "template-bundle",
      setup: { artifact: "template-bundle", fontHints: ["Prefer Inter for headings"] },
      prepared: {
        synthesis: {
          fontDecisions: [
            {
              family: "Inter",
              key: "default",
              reason: "applied",
              role: "heading",
              status: "applied",
            },
            {
              family: "JetBrains Mono",
              key: "default",
              reason: "profile-font-owned",
              role: "code",
              status: "blocked",
            },
          ],
          unsupportedDirections: ["Use Brand Sans for callouts"],
        },
      },
    } as unknown as PreparedMarkdownPdfCodexCandidate;

    expect(collectMarkdownPdfInteractiveFontReview(candidate)).toEqual({
      applied: [{ family: "Inter", key: "default", layer: "Template", role: "heading" }],
      blocked: [
        {
          family: "JetBrains Mono",
          key: "default",
          layer: "Template",
          reason: "profile font owned",
          role: "code",
        },
      ],
      unresolved: ["Use Brand Sans for callouts"],
    });
  });

  test("combines Project Profile and Template results with final unresolved directions", () => {
    const candidate = {
      artifact: "project-bundle",
      setup: { artifact: "project-bundle", fontHints: ["Prefer Inter"] },
      prepared: {
        profilePhase: {
          codexResult: {
            decision: {
              acceptedFontPatches: [
                { op: "replace-font", role: "pageChrome", key: "default", value: "Inter" },
              ],
            },
          },
        },
        templatePhase: {
          synthesis: {
            fontDecisions: [
              {
                family: "Source Serif 4",
                key: "default",
                reason: "applied",
                role: "body",
                status: "applied",
              },
            ],
          },
        },
        binding: { reportArtifact: { unsupportedDirections: ["Use font for side notes"] } },
      },
    } as unknown as PreparedMarkdownPdfCodexCandidate;

    expect(collectMarkdownPdfInteractiveFontReview(candidate)).toEqual({
      applied: [
        { family: "Inter", key: "default", layer: "Profile", role: "pageChrome" },
        { family: "Source Serif 4", key: "default", layer: "Template", role: "body" },
      ],
      blocked: [],
      unresolved: ["Use font for side notes"],
    });
  });

  test("renders validated mappings without inventing font-hint provenance", () => {
    const { runtime, stderr } = createCapturedRuntime();
    const candidate = {
      artifact: "template-bundle",
      setup: { artifact: "template-bundle", fontHints: ["Prefer Inter for headings"] },
      prepared: {
        outputPlan: {
          assets: [],
          styleCss: { bundlePath: "style.css" },
          templateHtml: { bundlePath: "template.html" },
        },
        signals: { signalMode: "hint-only" },
        synthesis: {
          decisionMode: "adapted",
          fontDecisions: [
            {
              family: "Inter",
              key: "default",
              reason: "applied",
              role: "heading",
              status: "applied",
            },
          ],
          unsupportedDirections: ["Use Brand Sans for callouts"],
        },
      },
    } as unknown as PreparedMarkdownPdfCodexCandidate;

    renderMarkdownPdfCodexCandidateReview(runtime, candidate);

    expect(stderr.text).toContain("Applied font mappings:\n- Template heading/default → Inter");
    expect(stderr.text).toContain("Unresolved directions:\n- Use Brand Sans for callouts");
    expect(stderr.text).not.toContain("Source: font hint");
  });
});
