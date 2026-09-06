import { describe, expect, test } from "bun:test";
import { stripVTControlCharacters } from "node:util";

import type {
  CodexDiscovery,
  CodexDiscoveryOptions,
  CodexInfoView,
} from "../../src/adapters/codex/discovery/types";
import { actionCodexInfo } from "../../src/cli/actions/codex-info";
import { buildCodexInfoReport } from "../../src/cli/codex-info/report";
import { createCapturedRuntime } from "../helpers/cli-test-utils";
import { discovery } from "./color-discovery";

const views = ["summary", "models", "providers"] as const;

async function output(
  view: CodexInfoView,
  details: boolean,
  options: {
    stdoutTty?: boolean;
    stderrTty?: boolean;
    enabled?: boolean;
    json?: boolean;
    discovery?: CodexDiscovery;
  } = {},
) {
  const capture = createCapturedRuntime({
    colorEnabled: options.enabled ?? true,
    cwd: discovery.context.cwd,
  });
  Object.assign(capture.stdout, { isTTY: options.stdoutTty ?? true });
  Object.assign(capture.stderr, { isTTY: options.stderrTty ?? false });
  const calls: CodexDiscoveryOptions[] = [];
  const data = options.discovery ?? discovery;
  await actionCodexInfo(capture.runtime, {
    view,
    details: options.json ? false : details,
    json: options.json,
    discover: async (request) => {
      calls.push(request);
      return { ...data, models: view === "providers" ? null : data.models };
    },
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ cwd: capture.runtime.cwd, view });
  expect(capture.stderr.text).toBe("");
  return capture.stdout.text;
}

describe("Codex information presentation color boundaries", () => {
  for (const view of views) {
    for (const details of [false, true]) {
      test(`${view} details=${details} styles stdout TTY without changing plain content`, async () => {
        const colored = await output(view, details);
        const plain = await output(view, details, { stdoutTty: false });
        expect(colored).toContain("\x1b[");
        expect(stripVTControlCharacters(colored)).toBe(plain);
        expect(plain).not.toContain("\x1b");
        // Selection is not verified success.
        expect(colored).not.toContain("\x1b[32m");
        expect(colored).not.toContain("\x1b[92m");
        expect(await output(view, details, { stdoutTty: false, stderrTty: true })).toBe(plain);
        expect(await output(view, details, { enabled: false, stderrTty: true })).toBe(plain);
      });
    }
    test(`${view} JSON is identical and unstyled across output eligibility`, async () => {
      const styledEligible = await output(view, false, { json: true });
      expect(styledEligible).not.toContain("\x1b");
      expect(styledEligible).toBe(await output(view, false, { json: true, stdoutTty: false }));
      expect(styledEligible).toBe(await output(view, false, { json: true, enabled: false }));
      expect(JSON.parse(styledEligible)).toEqual(
        buildCodexInfoReport(
          { ...discovery, models: view === "providers" ? null : discovery.models },
          view,
        ),
      );
    });
    test(`${view} escapes hostile metadata before applying presentation styling`, async () => {
      const hostile = "evil\x1b[2J\x1b]8;;https://example.invalid\x07\u009b\u202e\u2028\nforged";
      const data: CodexDiscovery = {
        context: { ...discovery.context, cwd: hostile, codexHome: hostile },
        config: {
          model: hostile,
          model_provider: hostile,
          model_providers: { [hostile]: { name: hostile } },
        },
        models: [
          {
            id: hostile,
            model: hostile,
            description: hostile,
            isDefault: true,
            supportedReasoningEfforts: [{ reasoningEffort: hostile, description: hostile }],
          },
        ],
      };
      const colored = await output(view, true, { discovery: data });
      const plain = await output(view, true, { discovery: data, enabled: false });
      expect(stripVTControlCharacters(colored)).toBe(plain);
      expect(colored).not.toContain("\x1b[2J");
      expect(colored).not.toContain("\x1b]8;");
      for (const control of ["\u009b", "\u202e", "\u2028", "\u0007"]) {
        expect(colored).not.toContain(control);
      }
      expect(colored).not.toContain("\nforged");
      expect(plain).toContain(
        "evil\\u001b[2J\\u001b]8;;https://example.invalid\\u0007\\u009b\\u202e\\u2028\\u000aforged",
      );
    });
  }
});
