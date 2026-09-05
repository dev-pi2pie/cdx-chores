import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmod, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";

import type {
  CodexDiscovery,
  CodexDiscoveryOptions,
  CodexInfoView,
} from "../../src/adapters/codex/discovery/types";
import { actionCodexInfo } from "../../src/cli/actions/codex-info";
import { buildCodexInfoReport } from "../../src/cli/codex-info/report";
import { createCapturedRuntime, REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils";

const views = ["summary", "models", "providers"] as const;
const discovery: CodexDiscovery = {
  context: {
    cwd: "/fixture/work",
    codexHome: "/fixture/home",
    codexHomeSource: "environment",
    codexVersion: "0.153.4",
  },
  config: {
    model: "model-a",
    model_provider: "proxy",
    model_reasoning_effort: "high",
    model_providers: { proxy: { name: "Example proxy" } },
  },
  models: [
    {
      id: "model-a",
      model: "model-a",
      isDefault: true,
      description: "Example model",
      supportedReasoningEfforts: [{ reasoningEffort: "low", description: "Less thought" }],
    },
  ],
};

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

  test("real CLI honors NO_COLOR, empty NO_COLOR, and --no-color with eligible output streams", async () => {
    await withTempFixtureDir("codex-color-policy", async (directory) => {
      const server = join(directory, "server.cjs");
      await writeFile(
        server,
        `#!/usr/bin/env node
const {createInterface} = require("node:readline");
const fixture = ${JSON.stringify(discovery)};
createInterface({input:process.stdin}).on("line", line => {
 const {id,method} = JSON.parse(line);
 if (method === "initialized") return;
 const result = method === "initialize"
   ? {userAgent:"cdx_chores/0.153.4",codexHome:process.env.CODEX_HOME}
   : method === "config/read" ? {config:fixture.config,origins:{},layers:null}
   : {data:fixture.models,nextCursor:null};
 console.log(JSON.stringify({id,result}));
});
`,
      );
      await chmod(server, 0o755);
      const runner = join(REPO_ROOT, "test/codex-info/fixtures/color-cli-runner.mjs");
      const baselineEnv: NodeJS.ProcessEnv = {
        ...process.env,
        HOME: directory,
        CODEX_HOME: directory,
        CDX_CHORES_CODEX_PATH: server,
      };
      delete baselineEnv.NO_COLOR;
      delete baselineEnv.FORCE_COLOR;
      delete baselineEnv.CASE_FLAG;
      delete baselineEnv.CDX_CHORES_COLOR_TEST_CLI_MODULE;
      const invoke = (extra: NodeJS.ProcessEnv) => {
        const result = spawnSync(process.execPath, [runner], {
          cwd: directory,
          env: { ...baselineEnv, ...extra },
          encoding: "utf8",
          timeout: 20_000,
        });
        expect(result.status).toBe(0);
        expect(result.stderr).toBe("");
        return JSON.parse(result.stdout) as {
          view: CodexInfoView;
          format: string;
          stdout: string;
          stderr: string;
        }[];
      };
      const baseline = invoke({ CASE_FLAG: "0" });
      for (const overrides of [{ NO_COLOR: "1" }, { NO_COLOR: "" }, { CASE_FLAG: "1" }]) {
        const disabled = invoke(overrides);
        expect(disabled).toHaveLength(9);
        for (const [index, item] of disabled.entries()) {
          expect(item.stderr).toBe("");
          expect(item.stdout).not.toContain("\x1b");
          const original = baseline[index]!;
          expect(original.stderr).toBe("");
          if (item.format === "json") {
            expect(original.stdout).not.toContain("\x1b");
            expect(JSON.parse(item.stdout)).toEqual(JSON.parse(original.stdout));
          } else {
            expect(original.stdout).toContain("\x1b[");
            expect(item.stdout).toBe(stripVTControlCharacters(original.stdout));
          }
        }
      }
    });
  }, 30_000);
});
