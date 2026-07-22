import { input } from "@inquirer/prompts";
import search from "@inquirer/search";

import { discoverSystemFonts } from "../../../../fonts/discovery";
import { printLine } from "../../../actions/shared";
import type { CliRuntime } from "../../../types";
import {
  buildMarkdownPdfInteractiveFontHintPreferenceChoices,
  collectInstalledFontFamilies,
} from "./suggestions";
import { promptMarkdownPdfInteractiveFontHintSearch } from "./search-prompt";
import { normalizeMarkdownPdfInteractiveFontHintText } from "./text";
import type {
  MarkdownPdfInteractiveFontHintSuggestionService,
  MarkdownPdfInteractiveFontHintSuggestionState,
} from "./types";

const FONT_HINT_DISCOVERY_TIMEOUT_MS = 1_000;
const FONT_HINT_DISCOVERY_STATUS_DELAY_MS = 150;
const FONT_HINT_UNAVAILABLE_NOTICE =
  "Installed font suggestions are unavailable; continuing with custom input.";
const FONT_HINT_SEARCH_PAGE_SIZE = 7;

type DiscoveryResolution =
  | { kind: "ready"; families: string[] }
  | { kind: "unavailable"; retriable: boolean; showNotice: boolean };

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
): Promise<DiscoveryResolution> {
  try {
    const discovery = await discover({
      platform: runtime.platform,
      discovery: "fontconfig",
      signal,
      timeoutMs: FONT_HINT_DISCOVERY_TIMEOUT_MS,
    });
    if (signal.aborted) {
      return { kind: "unavailable", retriable: false, showNotice: false };
    }
    const families = collectInstalledFontFamilies(discovery.faces);
    if (families.length === 0) {
      return { kind: "unavailable", retriable: true, showNotice: true };
    }
    return { kind: "ready", families };
  } catch (error) {
    if (signal.aborted || isAbortError(error)) {
      return { kind: "unavailable", retriable: false, showNotice: false };
    }
    return { kind: "unavailable", retriable: true, showNotice: true };
  }
}

export function createMarkdownPdfInteractiveFontHintSuggestionService(
  runtime: CliRuntime,
  options: {
    discover?: typeof discoverSystemFonts;
    inputPrompt?: typeof input;
    searchPrompt?: typeof search;
  } = {},
): MarkdownPdfInteractiveFontHintSuggestionService {
  const discover = options.discover ?? discoverSystemFonts;
  const inputPrompt = options.inputPrompt ?? input;
  const searchPrompt = options.searchPrompt ?? search;
  const controller = new AbortController();
  let state: MarkdownPdfInteractiveFontHintSuggestionState = { kind: "idle" };
  let discoveryPromise: Promise<DiscoveryResolution> | undefined;
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

  async function resolveDiscovery(forceRetry = false): Promise<DiscoveryResolution> {
    if (!forceRetry && state.kind === "ready") {
      return { kind: "ready", families: state.families };
    }
    if (!forceRetry && state.kind === "unavailable") {
      return {
        kind: "unavailable",
        retriable: state.retriable,
        showNotice: false,
      };
    }
    if (!discoveryPromise || forceRetry) {
      state = { kind: "loading" };
      armStatus();
      discoveryPromise = discoverInstalledFamilies(runtime, controller.signal, discover)
        .then((resolution) => {
          state =
            resolution.kind === "ready"
              ? { kind: "ready", families: resolution.families }
              : { kind: "unavailable", retriable: resolution.retriable };
          return resolution;
        })
        .finally(() => {
          clearStatus();
        });
    }
    return discoveryPromise;
  }

  return {
    cancel() {
      controller.abort();
    },
    getState() {
      return state;
    },
    async retryUnavailable() {
      const resolution = await resolveDiscovery(true);
      if (resolution.kind === "unavailable" && resolution.showNotice) {
        printLine(runtime.stderr, FONT_HINT_UNAVAILABLE_NOTICE);
      }
      return resolution.kind === "ready";
    },
    async promptPreference(current) {
      const resolution = await resolveDiscovery();
      if (controller.signal.aborted) {
        throw new DOMException("Font suggestion discovery was aborted.", "AbortError");
      }
      if (resolution.kind === "unavailable") {
        if (resolution.showNotice) {
          printLine(runtime.stderr, FONT_HINT_UNAVAILABLE_NOTICE);
        }
        return normalizeMarkdownPdfInteractiveFontHintText(
          await inputPrompt({
            message: "Font preference",
            default: current ?? "",
            validate: (value) =>
              normalizeMarkdownPdfInteractiveFontHintText(String(value)).length > 0 ||
              "Enter a font preference.",
          }),
        );
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
              families: resolution.families,
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
