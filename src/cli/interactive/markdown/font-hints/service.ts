import { input, select } from "@inquirer/prompts";
import search from "@inquirer/search";

import { discoverSystemFonts } from "../../../../fonts/discovery";
import { collectSearchableFontFamilies } from "../../../../fonts/search-records";
import type { SearchableFontFamily } from "../../../../fonts/types";
import { printLine } from "../../../actions/shared";
import type { CliRuntime } from "../../../types";
import { buildMarkdownPdfInteractiveFontHintPreferenceChoices } from "./suggestions";
import {
  promptMarkdownPdfInteractiveFontHintInput,
  promptMarkdownPdfInteractiveFontHintSearch,
  promptMarkdownPdfInteractiveFontHintSlowPath,
} from "./search-prompt";
import { normalizeMarkdownPdfInteractiveFontHintText } from "./text";
import type { MarkdownPdfInteractiveFontHintSuggestionService } from "./types";

const FONT_HINT_DISCOVERY_SOFT_WAIT_MS = 3_000;
const FONT_HINT_DISCOVERY_HARD_TIMEOUT_MS = 10_000;
const FONT_HINT_UNAVAILABLE_NOTICE =
  "Installed font suggestions are unavailable; continuing with custom input.";
const FONT_HINT_WAITING_STATUS = "Waiting for installed font families...";
const FONT_HINT_SEARCH_PAGE_SIZE = 7;
const FONT_HINT_DISCOVERY_ABORTED = Symbol("font-hint-discovery-aborted");
const FONT_HINT_DISCOVERY_SOFT_WAIT_REACHED = Symbol("font-hint-discovery-soft-wait-reached");
const FONT_HINT_DISCOVERY_TIMED_OUT = Symbol("font-hint-discovery-timed-out");

type DiscoveryResolution =
  | { kind: "ready"; records: SearchableFontFamily[] }
  | { kind: "unavailable"; showNotice: boolean };

type ScheduleDeadline = (callback: () => void, timeoutMs: number) => () => void;

interface ActiveDiscovery {
  abort(reason?: unknown): void;
  promise: Promise<DiscoveryResolution>;
}

type DiscoveryLifecycleState =
  | { kind: "idle" }
  | { kind: "pending"; discovery: ActiveDiscovery; slowPathOffered: boolean }
  | { kind: "settled"; resolution: DiscoveryResolution }
  | { kind: "custom"; resolution: DiscoveryResolution };

const scheduleDeadlineWithTimer: ScheduleDeadline = (callback, timeoutMs) => {
  const timeout = setTimeout(callback, timeoutMs);
  return () => clearTimeout(timeout);
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function clearTransientStatus(stream: NodeJS.WritableStream, statusShown: boolean): void {
  if (!statusShown || !("isTTY" in stream) || stream.isTTY !== true) {
    return;
  }
  stream.write("\u001B[1A\u001B[2K\u001B[G");
}

function startInstalledFamilyDiscovery(
  runtime: CliRuntime,
  signal: AbortSignal,
  discover: typeof discoverSystemFonts,
  scheduleDeadline: ScheduleDeadline,
  hardTimeoutMs: number,
): ActiveDiscovery {
  const discoveryController = new AbortController();
  let cancelDeadline: (() => void) | undefined;
  let resolveSessionAbort: ((value: typeof FONT_HINT_DISCOVERY_ABORTED) => void) | undefined;
  let hardDeadlineReached = false;
  const abortDiscovery = (reason: unknown = signal.reason) => {
    discoveryController.abort(reason);
    resolveSessionAbort?.(FONT_HINT_DISCOVERY_ABORTED);
  };
  const abortForSession = () => abortDiscovery(signal.reason);

  const promise = (async (): Promise<DiscoveryResolution> => {
    try {
      if (signal.aborted) {
        return { kind: "unavailable", showNotice: false };
      }
      signal.addEventListener("abort", abortForSession, { once: true });
      const sessionAbort = new Promise<typeof FONT_HINT_DISCOVERY_ABORTED>((resolve) => {
        resolveSessionAbort = resolve;
      });
      const deadline = new Promise<typeof FONT_HINT_DISCOVERY_TIMED_OUT>((resolve) => {
        cancelDeadline = scheduleDeadline(() => {
          hardDeadlineReached = true;
          discoveryController.abort(new DOMException("Font discovery timed out.", "TimeoutError"));
          resolve(FONT_HINT_DISCOVERY_TIMED_OUT);
        }, hardTimeoutMs);
      });
      const discovery = await Promise.race([
        discover({
          platform: runtime.platform,
          discovery: "fontconfig",
          signal: discoveryController.signal,
          timeoutMs: hardTimeoutMs,
        }),
        sessionAbort,
        deadline,
      ]);
      if (discovery === FONT_HINT_DISCOVERY_ABORTED || signal.aborted) {
        return { kind: "unavailable", showNotice: false };
      }
      if (discovery === FONT_HINT_DISCOVERY_TIMED_OUT) {
        return { kind: "unavailable", showNotice: true };
      }
      const records = collectSearchableFontFamilies(discovery.faces);
      return records.length === 0
        ? { kind: "unavailable", showNotice: true }
        : { kind: "ready", records };
    } catch (error) {
      if (signal.aborted) {
        return { kind: "unavailable", showNotice: false };
      }
      if (isAbortError(error)) {
        return { kind: "unavailable", showNotice: hardDeadlineReached };
      }
      return { kind: "unavailable", showNotice: true };
    } finally {
      cancelDeadline?.();
      signal.removeEventListener("abort", abortForSession);
    }
  })();

  return { abort: abortDiscovery, promise };
}

export function createMarkdownPdfInteractiveFontHintSuggestionService(
  runtime: CliRuntime,
  options: {
    discover?: typeof discoverSystemFonts;
    discoveryHardTimeoutMs?: number;
    discoverySoftWaitMs?: number;
    inputPrompt?: typeof input;
    scheduleDeadline?: ScheduleDeadline;
    searchPrompt?: typeof search;
    selectPrompt?: typeof select;
  } = {},
): MarkdownPdfInteractiveFontHintSuggestionService {
  const discover = options.discover ?? discoverSystemFonts;
  const discoveryHardTimeoutMs =
    options.discoveryHardTimeoutMs ?? FONT_HINT_DISCOVERY_HARD_TIMEOUT_MS;
  const discoverySoftWaitMs = options.discoverySoftWaitMs ?? FONT_HINT_DISCOVERY_SOFT_WAIT_MS;
  const inputPrompt = options.inputPrompt ?? input;
  const scheduleDeadline = options.scheduleDeadline ?? scheduleDeadlineWithTimer;
  const searchPrompt = options.searchPrompt ?? search;
  const selectPrompt = options.selectPrompt ?? select;
  const controller = new AbortController();
  let discoveryState: DiscoveryLifecycleState = { kind: "idle" };
  let unavailableNoticeShown = false;
  let statusShown = false;

  function showWaitingStatus(): void {
    if (!("isTTY" in runtime.stderr) || runtime.stderr.isTTY !== true) {
      return;
    }
    statusShown = true;
    printLine(runtime.stderr, FONT_HINT_WAITING_STATUS);
  }

  function clearWaitingStatus(): void {
    clearTransientStatus(runtime.stderr, statusShown);
    statusShown = false;
  }

  function ensureDiscovery(): Extract<DiscoveryLifecycleState, { kind: "pending" }> {
    if (discoveryState.kind === "idle") {
      const discovery = startInstalledFamilyDiscovery(
        runtime,
        controller.signal,
        discover,
        scheduleDeadline,
        discoveryHardTimeoutMs,
      );
      discoveryState = { kind: "pending", discovery, slowPathOffered: false };
      void discovery.promise.then((resolution) => {
        if (discoveryState.kind === "pending" && discoveryState.discovery === discovery) {
          discoveryState = { kind: "settled", resolution };
        }
      });
    }
    if (discoveryState.kind !== "pending") {
      throw new TypeError("Font discovery was expected to be pending.");
    }
    return discoveryState;
  }

  function currentSettledResolution(): DiscoveryResolution | undefined {
    return discoveryState.kind === "settled" ? discoveryState.resolution : undefined;
  }

  async function waitWithStatus(discovery: ActiveDiscovery): Promise<DiscoveryResolution> {
    let settled = false;
    const monitoredDiscovery = discovery.promise.finally(() => {
      settled = true;
    });
    await Promise.resolve();
    if (!settled) {
      showWaitingStatus();
    }
    try {
      return await monitoredDiscovery;
    } finally {
      clearWaitingStatus();
    }
  }

  async function resolveDiscovery(): Promise<DiscoveryResolution | undefined> {
    if (discoveryState.kind === "custom" || discoveryState.kind === "settled") {
      return discoveryState.resolution;
    }
    const pending = ensureDiscovery();
    if (pending.slowPathOffered) {
      return await waitWithStatus(pending.discovery);
    }

    let cancelSoftWait: (() => void) | undefined;
    const softWait = new Promise<typeof FONT_HINT_DISCOVERY_SOFT_WAIT_REACHED>((resolve) => {
      cancelSoftWait = scheduleDeadline(
        () => resolve(FONT_HINT_DISCOVERY_SOFT_WAIT_REACHED),
        discoverySoftWaitMs,
      );
    });
    const initialOutcome = await Promise.race([pending.discovery.promise, softWait]);
    cancelSoftWait?.();
    if (initialOutcome !== FONT_HINT_DISCOVERY_SOFT_WAIT_REACHED) {
      return initialOutcome;
    }

    if (discoveryState.kind === "pending") {
      discoveryState.slowPathOffered = true;
    }
    const choice = await promptMarkdownPdfInteractiveFontHintSlowPath(
      runtime,
      selectPrompt,
      {
        message: "Installed font discovery is taking longer than expected",
        default: "custom",
        choices: [
          {
            name: "Continue with custom input",
            value: "custom",
            description: "Stop installed-font discovery and enter a preference directly.",
          },
          {
            name: "Keep waiting for installed fonts",
            value: "wait",
            description: "Wait within the existing ten-second discovery ceiling.",
          },
        ],
      },
      controller.signal,
    );
    if (choice === undefined) {
      return undefined;
    }
    if (choice === "custom") {
      const resolution: DiscoveryResolution = { kind: "unavailable", showNotice: false };
      discoveryState = { kind: "custom", resolution };
      pending.discovery.abort(new DOMException("Custom font input selected.", "AbortError"));
      return resolution;
    }
    const resolution = currentSettledResolution();
    if (resolution) {
      return resolution;
    }
    return await waitWithStatus(pending.discovery);
  }

  return {
    cancel() {
      controller.abort();
    },
    async promptPreference(current) {
      const resolution = await resolveDiscovery();
      if (resolution === undefined) {
        return undefined;
      }
      if (controller.signal.aborted) {
        throw new DOMException("Font suggestion discovery was aborted.", "AbortError");
      }
      if (resolution.kind === "unavailable") {
        if (resolution.showNotice && !unavailableNoticeShown) {
          unavailableNoticeShown = true;
          printLine(runtime.stderr, FONT_HINT_UNAVAILABLE_NOTICE);
        }
        const selected = await promptMarkdownPdfInteractiveFontHintInput(
          runtime,
          inputPrompt,
          {
            message: "Font preference",
            default: current ?? "",
            validate: (value) =>
              normalizeMarkdownPdfInteractiveFontHintText(String(value)).length > 0 ||
              "Enter a font preference.",
          },
          controller.signal,
        );
        return selected === undefined
          ? undefined
          : normalizeMarkdownPdfInteractiveFontHintText(selected);
      }

      const defaultPreference = normalizeMarkdownPdfInteractiveFontHintText(current ?? "");
      const selected = await promptMarkdownPdfInteractiveFontHintSearch(
        runtime,
        searchPrompt,
        {
          message: "Font preference",
          default: defaultPreference || undefined,
          pageSize: FONT_HINT_SEARCH_PAGE_SIZE,
          source: async (term, { signal }) => {
            if (signal.aborted || controller.signal.aborted) {
              return [];
            }
            return buildMarkdownPdfInteractiveFontHintPreferenceChoices({
              term,
              current: defaultPreference,
              records: resolution.records,
            });
          },
          validate: (value) =>
            normalizeMarkdownPdfInteractiveFontHintText(String(value)).length > 0 ||
            "Enter a font preference.",
        },
        controller.signal,
      );
      return selected === undefined
        ? undefined
        : normalizeMarkdownPdfInteractiveFontHintText(selected);
    },
  };
}
