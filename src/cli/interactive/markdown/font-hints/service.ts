import { input } from "@inquirer/prompts";
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
} from "./search-prompt";
import { normalizeMarkdownPdfInteractiveFontHintText } from "./text";
import type { MarkdownPdfInteractiveFontHintSuggestionService } from "./types";

const FONT_HINT_DISCOVERY_TIMEOUT_MS = 1_000;
const FONT_HINT_DISCOVERY_STATUS_DELAY_MS = 150;
const FONT_HINT_UNAVAILABLE_NOTICE =
  "Installed font suggestions are unavailable; continuing with custom input.";
const FONT_HINT_SEARCH_PAGE_SIZE = 7;
const FONT_HINT_DISCOVERY_ABORTED = Symbol("font-hint-discovery-aborted");
const FONT_HINT_DISCOVERY_TIMED_OUT = Symbol("font-hint-discovery-timed-out");

type DiscoveryResolution =
  | { kind: "ready"; records: SearchableFontFamily[] }
  | { kind: "unavailable"; showNotice: boolean };

type ScheduleDeadline = (callback: () => void, timeoutMs: number) => () => void;

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

async function discoverInstalledFamilies(
  runtime: CliRuntime,
  signal: AbortSignal,
  discover: typeof discoverSystemFonts,
  now: () => number,
  scheduleDeadline: ScheduleDeadline,
  timeoutMs: number,
): Promise<DiscoveryResolution> {
  const startedAt = now();
  const discoveryController = new AbortController();
  let cancelDeadline: (() => void) | undefined;
  let resolveSessionAbort: ((value: typeof FONT_HINT_DISCOVERY_ABORTED) => void) | undefined;
  const abortDiscovery = () => {
    discoveryController.abort(signal.reason);
    resolveSessionAbort?.(FONT_HINT_DISCOVERY_ABORTED);
  };
  try {
    if (signal.aborted) {
      return { kind: "unavailable", showNotice: false };
    }
    signal.addEventListener("abort", abortDiscovery, { once: true });
    const sessionAbort = new Promise<typeof FONT_HINT_DISCOVERY_ABORTED>((resolve) => {
      resolveSessionAbort = resolve;
    });
    const deadline = new Promise<typeof FONT_HINT_DISCOVERY_TIMED_OUT>((resolve) => {
      cancelDeadline = scheduleDeadline(() => {
        discoveryController.abort(new DOMException("Font discovery timed out.", "TimeoutError"));
        resolve(FONT_HINT_DISCOVERY_TIMED_OUT);
      }, timeoutMs);
    });
    const discovery = await Promise.race([
      discover({
        platform: runtime.platform,
        discovery: "fontconfig",
        signal: discoveryController.signal,
        timeoutMs,
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
    if (now() - startedAt >= timeoutMs) {
      return { kind: "unavailable", showNotice: true };
    }
    if (records.length === 0) {
      return { kind: "unavailable", showNotice: true };
    }
    return { kind: "ready", records };
  } catch (error) {
    if (signal.aborted || isAbortError(error)) {
      return { kind: "unavailable", showNotice: false };
    }
    return { kind: "unavailable", showNotice: true };
  } finally {
    cancelDeadline?.();
    signal.removeEventListener("abort", abortDiscovery);
  }
}

export function createMarkdownPdfInteractiveFontHintSuggestionService(
  runtime: CliRuntime,
  options: {
    discover?: typeof discoverSystemFonts;
    discoveryTimeoutMs?: number;
    inputPrompt?: typeof input;
    now?: () => number;
    scheduleDeadline?: ScheduleDeadline;
    searchPrompt?: typeof search;
  } = {},
): MarkdownPdfInteractiveFontHintSuggestionService {
  const discover = options.discover ?? discoverSystemFonts;
  const discoveryTimeoutMs = options.discoveryTimeoutMs ?? FONT_HINT_DISCOVERY_TIMEOUT_MS;
  const inputPrompt = options.inputPrompt ?? input;
  const now = options.now ?? Date.now;
  const scheduleDeadline = options.scheduleDeadline ?? scheduleDeadlineWithTimer;
  const searchPrompt = options.searchPrompt ?? search;
  const controller = new AbortController();
  let discoveryPromise: Promise<DiscoveryResolution> | undefined;
  let unavailableNoticeShown = false;
  let statusTimer: NodeJS.Timeout | undefined;
  let statusShown = false;

  function armStatus(): void {
    if (!("isTTY" in runtime.stderr) || runtime.stderr.isTTY !== true) {
      return;
    }
    statusTimer = setTimeout(() => {
      statusShown = true;
      printLine(runtime.stderr, "Discovering installed font families...");
    }, FONT_HINT_DISCOVERY_STATUS_DELAY_MS);
  }

  function clearStatus(): void {
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = undefined;
    }
    clearTransientStatus(runtime.stderr, statusShown);
    statusShown = false;
  }

  async function resolveDiscovery(): Promise<DiscoveryResolution> {
    if (!discoveryPromise) {
      armStatus();
      discoveryPromise = discoverInstalledFamilies(
        runtime,
        controller.signal,
        discover,
        now,
        scheduleDeadline,
        discoveryTimeoutMs,
      ).finally(() => {
        clearStatus();
      });
    }
    return discoveryPromise;
  }

  return {
    cancel() {
      controller.abort();
    },
    async promptPreference(current) {
      const resolution = await resolveDiscovery();
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
