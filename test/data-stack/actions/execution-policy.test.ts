import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionDataStack } from "../../../src/cli/actions/data-stack/run";
import { registerDataStackCommand } from "../../../src/cli/commands/data/stack";
import {
  classifyDataStackCodexAssistFailure,
  formatDataStackCodexAssistFailure,
  suggestDataStackWithCodex,
  type SuggestDataStackWithCodexOptions,
} from "../../../src/cli/data-stack/codex-assist";
import { createCapturedRuntime, withTempFixtureDir } from "../../helpers/cli-test-utils";

describe("data stack execution policy", () => {
  for (const custom of [false, true]) {
    test(`command forwards ${custom ? "custom" : "default"} settings to the runner without saving them`, async () => {
      await withTempFixtureDir("data-stack-execution", async (fixtureDir) => {
        await writeFile(join(fixtureDir, "a.csv"), "id,status\n1,active\n");
        const { runtime } = createCapturedRuntime({ cwd: fixtureDir });
        const program = new Command().exitOverride();
        let calls = 0;
        registerDataStackCommand(program.command("data"), runtime, {
          actionDataStack: (runtime, options) =>
            actionDataStack(runtime, {
              ...options,
              codexRunner: async ({ codexExecution, timeoutMs, prompt }) => {
                calls++;
                expect(codexExecution).toEqual(
                  custom
                    ? {
                        model: "example-model",
                        provider: "example-provider",
                        reasoningEffort: "medium",
                      }
                    : { reasoningEffort: "low" },
                );
                expect(Object.isFrozen(codexExecution)).toBe(true);
                expect(timeoutMs).toBe(75_000);
                expect(prompt).not.toContain("example-provider");
                return JSON.stringify({ recommendations: [] });
              },
            }),
          actionDataStackReplay: async () => {
            throw new Error("Unexpected replay action");
          },
        });
        await program.parseAsync([
          "node",
          "test",
          "data",
          "stack",
          "a.csv",
          "--output",
          "merged.csv",
          "--dry-run",
          "--codex-assist",
          "--plan-output",
          "plan.json",
          "--codex-report-output",
          "report.json",
          "--codex-timeout",
          "75s",
          ...(custom
            ? [
                "--codex-model",
                " example-model ",
                "--codex-provider",
                " example-provider ",
                "--codex-reasoning-effort",
                "medium",
              ]
            : []),
        ]);
        expect(calls).toBe(1);
        for (const name of ["plan.json", "report.json"]) {
          const text = await readFile(join(fixtureDir, name), "utf8");
          expect(text).not.toContain("codexExecution");
          expect(text).not.toContain("example-model");
          expect(text).not.toContain("example-provider");
          expect(text).not.toContain("reasoningEffort");
        }
      });
    });
  }

  test("execution options do not enable assist", async () => {
    await withTempFixtureDir("data-stack-no-assist", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "id\n1\n");
      const { runtime } = createCapturedRuntime({ cwd: fixtureDir });
      let calls = 0;
      await actionDataStack(runtime, {
        sources: ["a.csv"],
        output: "merged.csv",
        codexExecution: { model: "example-model" },
        codexRunner: async () => {
          calls++;
          return JSON.stringify({ recommendations: [] });
        },
      });
      expect(calls).toBe(0);
      expect(await readFile(join(fixtureDir, "merged.csv"), "utf8")).toBe("id\n1\n");
    });
  });

  test("invalid direct settings fail before preparation with assist disabled", async () => {
    const { runtime, stdout, stderr } = createCapturedRuntime();
    await expect(
      actionDataStack(runtime, {
        sources: ["missing.csv"],
        output: "merged.csv",
        codexExecution: { provider: " " },
      }),
    ).rejects.toThrow("Codex provider must be a non-empty string");
    expect(stdout.text + stderr.text).toBe("");
  });

  test("incompatible effort remains visible without retrying or changing the saved plan", async () => {
    await withTempFixtureDir("data-stack-incompatible-effort", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "id\n1\n");
      const { runtime } = createCapturedRuntime({ cwd: fixtureDir });
      let calls = 0;
      await expect(
        actionDataStack(runtime, {
          sources: ["a.csv"],
          output: "merged.csv",
          dryRun: true,
          planOutput: "plan.json",
          codexReportOutput: "report.json",
          codexAssist: true,
          codexExecution: { model: "example-model", reasoningEffort: "high" },
          codexRunner: async ({ codexExecution }) => {
            calls++;
            expect(codexExecution).toEqual({ model: "example-model", reasoningEffort: "high" });
            throw new Error("invalid_request_error: effort high is unsupported");
          },
        }),
      ).rejects.toThrow("effort high is unsupported");
      expect(calls).toBe(1);
      expect(await readFile(join(fixtureDir, "plan.json"), "utf8")).not.toContain("codexExecution");
      await expect(readFile(join(fixtureDir, "report.json"), "utf8")).rejects.toThrow();
    });
  });

  test("direct suggestions validate before reading plan data or invoking a runner", async () => {
    let calls = 0;
    await expect(
      suggestDataStackWithCodex({
        codexExecution: { model: " " },
        runner: async () => {
          calls++;
          return "";
        },
      } as unknown as SuggestDataStackWithCodexOptions),
    ).rejects.toThrow("Codex model must be a non-empty string");
    expect(calls).toBe(0);
  });

  for (const message of [
    '{"error":{"type":"invalid_request_error","message":"Unknown model"}}',
    "invalid_request_error: provider is unknown",
    "invalid_request_error: reasoning effort high is unsupported",
  ]) {
    test(`configuration failure is not classified as a schema failure: ${message}`, () => {
      expect(classifyDataStackCodexAssistFailure(new Error(message))).toBe("unavailable");
      expect(formatDataStackCodexAssistFailure(new Error(message))).not.toContain("schema");
    });
  }

  for (const message of [
    '{"error":{"type":"invalid_request_error","code":"invalid_json_schema"}}',
    "Invalid schema for response_format",
    "Rejected structured recommendation schema",
  ]) {
    test(`explicit schema failure retains its classification: ${message}`, () => {
      expect(classifyDataStackCodexAssistFailure(new Error(message))).toBe(
        "structured-output-schema",
      );
      expect(formatDataStackCodexAssistFailure(new Error(message))).toContain(
        "structured recommendation schema",
      );
    });
  }
});
