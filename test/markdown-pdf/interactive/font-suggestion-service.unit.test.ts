import { describe, expect, test } from "bun:test";
import type { input, select } from "@inquirer/prompts";
import search from "@inquirer/search";
import { PassThrough } from "node:stream";

import { createMarkdownPdfInteractiveFontHintSuggestionService } from "../../../src/cli/interactive/markdown/font-hints";
import { createCapturedRuntime } from "../../helpers/cli-test-utils";

import { face, discoveryResult, promptTick } from "./font-suggestion-support";

function createDeferred<T>(): {
  promise: Promise<T>;
  reject(error: unknown): void;
  resolve(value: T): void;
} {
  let rejectPromise: (error: unknown) => void = () => {};
  let resolvePromise: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, reject: rejectPromise, resolve: resolvePromise };
}

function createDeadlineScheduler() {
  const scheduled: Array<{ active: boolean; callback: () => void; timeoutMs: number }> = [];
  return {
    scheduled,
    active(timeoutMs: number): number {
      return scheduled.filter((task) => task.active && task.timeoutMs === timeoutMs).length;
    },
    schedule(callback: () => void, timeoutMs: number): () => void {
      const task = { active: true, callback, timeoutMs };
      scheduled.push(task);
      return () => {
        task.active = false;
      };
    },
    run(timeoutMs: number): void {
      const task = scheduled.find(
        (candidate) => candidate.active && candidate.timeoutMs === timeoutMs,
      );
      if (!task) {
        throw new Error(`No active ${timeoutMs} ms deadline is scheduled.`);
      }
      task.active = false;
      task.callback();
    },
  };
}

async function reachSoftThreshold(
  scheduler: ReturnType<typeof createDeadlineScheduler>,
): Promise<void> {
  await Promise.resolve();
  scheduler.run(3_000);
  await promptTick();
}

describe("Markdown PDF Interactive font hint suggestion service", () => {
  test("starts lazily, caches family-only inventory, and filters without rediscovery", async () => {
    const { runtime } = createCapturedRuntime();
    let discoveryCalls = 0;
    let visibleChoices = "";
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async (options) => {
        discoveryCalls += 1;
        expect(options?.discovery).toBe("fontconfig");
        expect(options?.platform).toBe(runtime.platform);
        expect(options?.timeoutMs).toBe(10_000);
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

  test("searches retained alias metadata and returns only the primary family", async () => {
    const { runtime } = createCapturedRuntime();
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async () => ({
        adapter: "fontconfig",
        discovery: "fontconfig",
        faces: [
          {
            ...face("Noto Sans CJK JP"),
            aliases: ["Noto Sans JP"],
            fullName: "Noto Sans CJK JP Regular,Noto Sans JP Regular",
            fullNames: ["Noto Sans CJK JP Regular", "Noto Sans JP Regular"],
          },
        ],
        warnings: [],
      }),
      searchPrompt: (async (options: Parameters<typeof search>[0]) => {
        expect(
          await options.source?.("Noto Sans JP Regular", {
            signal: new AbortController().signal,
          }),
        ).toEqual([
          {
            name: "Noto Sans JP Regular",
            value: "Noto Sans JP Regular",
            description: "Use the typed text as a custom font preference.",
          },
          "Noto Sans CJK JP",
        ]);
        return "Noto Sans CJK JP";
      }) as typeof search,
    });

    expect(await service.promptPreference()).toBe("Noto Sans CJK JP");
  });

  test("cancels soft and hard deadlines after discovery resolves before the soft threshold", async () => {
    const { runtime } = createCapturedRuntime();
    const scheduler = createDeadlineScheduler();
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async () => discoveryResult(["Inter"]),
      scheduleDeadline: scheduler.schedule,
      searchPrompt: (async () => "Inter") as typeof search,
    });

    expect(await service.promptPreference()).toBe("Inter");
    expect(scheduler.active(3_000)).toBe(0);
    expect(scheduler.active(10_000)).toBe(0);
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

  test("caches command failure and shows its unavailable notice at most once", async () => {
    const { runtime, stderr } = createCapturedRuntime();
    let discoveryCalls = 0;
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async () => {
        discoveryCalls += 1;
        throw new Error("fontconfig failed");
      },
      inputPrompt: (async () => "Brand Sans") as typeof input,
    });

    expect(await service.promptPreference()).toBe("Brand Sans");
    expect(await service.promptPreference()).toBe("Brand Sans");
    expect(discoveryCalls).toBe(1);
    expect(stderr.text.match(/Installed font suggestions are unavailable/g)).toHaveLength(1);
  });

  test("offers custom input once at the soft threshold and caches that choice silently", async () => {
    const { runtime, stderr } = createCapturedRuntime();
    const scheduler = createDeadlineScheduler();
    let discoveryCalls = 0;
    let discoverySignal: AbortSignal | undefined;
    let slowPathCalls = 0;
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async (options) => {
        discoveryCalls += 1;
        discoverySignal = options?.signal;
        return await new Promise((resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        });
      },
      inputPrompt: (async () => "Brand Sans") as typeof input,
      scheduleDeadline: scheduler.schedule,
      selectPrompt: (async (options, context) => {
        slowPathCalls += 1;
        const slowPathOptions = options as unknown as {
          choices: readonly { value: string }[];
          default?: string;
        };
        expect(slowPathOptions.default).toBe("custom");
        expect(slowPathOptions.choices.map((choice) => choice.value)).toEqual(["custom", "wait"]);
        expect(context?.signal).toBeInstanceOf(AbortSignal);
        return "custom";
      }) as typeof select,
    });

    const first = service.promptPreference();
    await reachSoftThreshold(scheduler);
    expect(await first).toBe("Brand Sans");
    await promptTick();
    expect(await service.promptPreference("Brand Sans")).toBe("Brand Sans");
    expect(discoveryCalls).toBe(1);
    expect(slowPathCalls).toBe(1);
    expect(discoverySignal?.aborted).toBe(true);
    expect(scheduler.active(3_000)).toBe(0);
    expect(scheduler.active(10_000)).toBe(0);
    expect(stderr.text).not.toContain("Installed font suggestions are unavailable");
  });

  test("reuses the same promise and original hard deadline after continued waiting", async () => {
    const { runtime, stderr } = createCapturedRuntime();
    (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
    const scheduler = createDeadlineScheduler();
    const discovery = createDeferred<ReturnType<typeof discoveryResult>>();
    let discoveryCalls = 0;
    let slowPathCalls = 0;
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async () => {
        discoveryCalls += 1;
        return await discovery.promise;
      },
      scheduleDeadline: scheduler.schedule,
      searchPrompt: (async () => "Inter") as typeof search,
      selectPrompt: (async () => {
        slowPathCalls += 1;
        return "wait";
      }) as typeof select,
    });

    const pending = service.promptPreference();
    await reachSoftThreshold(scheduler);
    expect(stderr.text).toContain("Waiting for installed font families...");
    expect(scheduler.scheduled.filter((task) => task.timeoutMs === 10_000)).toHaveLength(1);
    discovery.resolve(discoveryResult(["Inter"]));

    expect(await pending).toBe("Inter");
    expect(discoveryCalls).toBe(1);
    expect(stderr.text).toContain("\u001b[1A\u001b[2K\u001b[G");
    const outputAfterFirstPrompt = stderr.text;
    expect(await service.promptPreference()).toBe("Inter");
    expect(discoveryCalls).toBe(1);
    expect(slowPathCalls).toBe(1);
    expect(stderr.text).toBe(outputAfterFirstPrompt);
    expect(scheduler.active(3_000)).toBe(0);
    expect(scheduler.active(10_000)).toBe(0);
  });

  test("keeps explicit custom input authoritative when discovery completes during the choice", async () => {
    const { runtime, stderr } = createCapturedRuntime();
    const scheduler = createDeadlineScheduler();
    const discovery = createDeferred<ReturnType<typeof discoveryResult>>();
    const slowPathChoice = createDeferred<"custom" | "wait">();
    let searchCalls = 0;
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async () => await discovery.promise,
      inputPrompt: (async () => "Brand Sans") as typeof input,
      scheduleDeadline: scheduler.schedule,
      searchPrompt: (async () => {
        searchCalls += 1;
        return "Inter";
      }) as typeof search,
      selectPrompt: (async () => await slowPathChoice.promise) as typeof select,
    });

    const pending = service.promptPreference();
    await reachSoftThreshold(scheduler);
    discovery.resolve(discoveryResult(["Inter"]));
    await promptTick();
    slowPathChoice.resolve("custom");

    expect(await pending).toBe("Brand Sans");
    expect(searchCalls).toBe(0);
    expect(scheduler.active(3_000)).toBe(0);
    expect(scheduler.active(10_000)).toBe(0);
    expect(stderr.text).not.toContain("Installed font suggestions are unavailable");
  });

  test("uses the completed discovery when continued waiting is chosen from the visible choice", async () => {
    const { runtime, stderr } = createCapturedRuntime();
    (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
    const scheduler = createDeadlineScheduler();
    const discovery = createDeferred<ReturnType<typeof discoveryResult>>();
    const slowPathChoice = createDeferred<"custom" | "wait">();
    let discoveryCalls = 0;
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async () => {
        discoveryCalls += 1;
        return await discovery.promise;
      },
      scheduleDeadline: scheduler.schedule,
      searchPrompt: (async () => "Inter") as typeof search,
      selectPrompt: (async () => await slowPathChoice.promise) as typeof select,
    });

    const pending = service.promptPreference();
    await reachSoftThreshold(scheduler);
    discovery.resolve(discoveryResult(["Inter"]));
    await promptTick();
    slowPathChoice.resolve("wait");

    expect(await pending).toBe("Inter");
    expect(discoveryCalls).toBe(1);
    expect(stderr.text).not.toContain("Waiting for installed font families...");
  });

  test("shows the slow-path choice at most once after back navigation", async () => {
    const { runtime } = createCapturedRuntime();
    runtime.stdin = new PassThrough() as unknown as NodeJS.ReadStream;
    const scheduler = createDeadlineScheduler();
    const discovery = createDeferred<ReturnType<typeof discoveryResult>>();
    let slowPathCalls = 0;
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async () => await discovery.promise,
      scheduleDeadline: scheduler.schedule,
      searchPrompt: (async () => "Inter") as typeof search,
      selectPrompt: ((_options, context) => {
        slowPathCalls += 1;
        return new Promise<string>((_resolve, reject) => {
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
        });
      }) as typeof select,
    });

    const first = service.promptPreference();
    await reachSoftThreshold(scheduler);
    expect(await first).toBeUndefined();
    expect(scheduler.active(3_000)).toBe(0);
    expect(scheduler.active(10_000)).toBe(1);

    const second = service.promptPreference();
    await promptTick();
    discovery.resolve(discoveryResult(["Inter"]));
    expect(await second).toBe("Inter");
    expect(slowPathCalls).toBe(1);
    expect(scheduler.active(10_000)).toBe(0);
  });

  test("cancels discovery and the visible slow-path prompt without an unavailable notice", async () => {
    const { runtime, stderr } = createCapturedRuntime();
    const scheduler = createDeadlineScheduler();
    let discoverySignal: AbortSignal | undefined;
    let inputCalls = 0;
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async (options) => {
        discoverySignal = options?.signal;
        return await new Promise((resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        });
      },
      inputPrompt: (async () => {
        inputCalls += 1;
        return "Brand Sans";
      }) as typeof input,
      scheduleDeadline: scheduler.schedule,
      selectPrompt: ((_options, context) =>
        new Promise<string>((_resolve, reject) => {
          context?.signal?.addEventListener(
            "abort",
            () => {
              const error = new Error("Prompt was aborted");
              error.name = "AbortPromptError";
              reject(error);
            },
            { once: true },
          );
        })) as typeof select,
    });

    const pending = service.promptPreference();
    await reachSoftThreshold(scheduler);
    service.cancel();

    await expect(pending).rejects.toMatchObject({ name: "AbortPromptError" });
    expect(discoverySignal?.aborted).toBe(true);
    expect(inputCalls).toBe(0);
    expect(stderr.text).not.toContain("unavailable");
  });

  test("accepts success before the hard boundary and aborts discovery at the hard deadline", async () => {
    const scheduler = createDeadlineScheduler();

    const successfulRuntime = createCapturedRuntime();
    const successfulDiscovery = createDeferred<ReturnType<typeof discoveryResult>>();
    const successfulService = createMarkdownPdfInteractiveFontHintSuggestionService(
      successfulRuntime.runtime,
      {
        discover: async () => await successfulDiscovery.promise,
        scheduleDeadline: scheduler.schedule,
        searchPrompt: (async () => "Inter") as typeof search,
        selectPrompt: (async () => "wait") as typeof select,
      },
    );
    const successful = successfulService.promptPreference();
    await reachSoftThreshold(scheduler);
    successfulDiscovery.resolve(discoveryResult(["Inter"]));
    expect(await successful).toBe("Inter");

    const timedOutRuntime = createCapturedRuntime();
    const timeoutScheduler = createDeadlineScheduler();
    let timedOutDiscoveryCalls = 0;
    let timedOutSignal: AbortSignal | undefined;
    const timedOutChoice = createDeferred<"custom" | "wait">();
    const timedOutService = createMarkdownPdfInteractiveFontHintSuggestionService(
      timedOutRuntime.runtime,
      {
        discover: async (options) => {
          timedOutDiscoveryCalls += 1;
          timedOutSignal = options?.signal;
          return await new Promise((resolve, reject) => {
            options?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("aborted", "AbortError")),
              { once: true },
            );
          });
        },
        inputPrompt: (async () => "Brand Sans") as typeof input,
        scheduleDeadline: timeoutScheduler.schedule,
        selectPrompt: (async () => await timedOutChoice.promise) as typeof select,
      },
    );
    const timedOut = timedOutService.promptPreference();
    await reachSoftThreshold(timeoutScheduler);
    timeoutScheduler.run(10_000);
    await promptTick();
    timedOutChoice.resolve("wait");

    expect(await timedOut).toBe("Brand Sans");
    expect(await timedOutService.promptPreference()).toBe("Brand Sans");
    expect(timedOutDiscoveryCalls).toBe(1);
    expect(timeoutScheduler.scheduled.filter((task) => task.timeoutMs === 3_000)).toHaveLength(1);
    expect(timeoutScheduler.active(3_000)).toBe(0);
    expect(timeoutScheduler.active(10_000)).toBe(0);
    expect(timedOutSignal?.aborted).toBe(true);
    expect(
      timedOutRuntime.stderr.text.match(/Installed font suggestions are unavailable/g),
    ).toHaveLength(1);
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
});
