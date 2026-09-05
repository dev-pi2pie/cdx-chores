import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

import { prepareMarkdownPdfCodexCandidate } from "../../src/cli/interactive/markdown/codex-service";
import { createActionTestRuntime } from "../helpers/cli-action-test-utils";
import { runInteractiveHarness } from "../cli-foundations/interactive-harness";
import { recipesCodexSelections } from "../markdown-pdf/interactive/codex-authoring-fixtures";

describe("Interactive Markdown execution configuration", () => {
  test("retains execution settings after returning to the Markdown submenu and reopening authoring", () => {
    const codexExecution = {
      model: "Model-A",
      provider: "Provider-A",
      reasoningEffort: "high",
    } as const;
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      codexExecution,
      selectQueue: [
        ...recipesCodexSelections("profile"),
        "continue",
        "change-artifact",
        "back",
        "md:pdf-recipes",
        "profile",
        "codex-assistant",
        "none",
        "continue",
        "cancel",
      ],
      inputQueue: ["", ""],
      confirmQueue: [false, true, false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls.map((call) => call.codexExecution)).toEqual([
      codexExecution,
      codexExecution,
    ]);
    expect(result.markdownPdfCodexPrepareCalls.map((call) => call.candidateId)).toEqual([
      "codex-profile-1",
      "codex-profile-2",
    ]);
    expect(
      result.promptCalls.filter((call) => call.message === "Choose a markdown command"),
    ).toHaveLength(2);
    expect(result.markdownPdfCodexBindCalls).toEqual([]);
    expect(result.markdownPdfCodexWriteCalls).toEqual([]);
  });

  test("the candidate service rejects invalid settings before accessing setup", async () => {
    let touched = false;
    const { runtime } = createActionTestRuntime({ cwd: "/fixtures" });
    await expect(
      prepareMarkdownPdfCodexCandidate(
        runtime,
        {
          artifact: "profile",
          fontHints: [],
          get sample(): never {
            touched = true;
            throw new Error("Unexpected setup access");
          },
        },
        { codexExecution: { model: " " } },
      ),
    ).rejects.toThrow("model");
    expect(touched).toBe(false);
  });

  test("candidate service forwards execution to all three preparation branches without persisting it", () => {
    const script = `
      import { mock } from "bun:test";
      const calls = [];
      const capture = (artifact) => async (_runtime, options) => { calls.push({artifact, execution: options.codexExecution, timeoutMs: options.timeoutMs}); return {artifact}; };
      mock.module("./src/cli/markdown-pdf/profile-codex", () => ({ prepareMarkdownPdfProfileCodex: capture("profile"), bindMarkdownPdfProfileCodexDestination() {}, commitPreparedMarkdownPdfProfileCodex() {} }));
      mock.module("./src/cli/markdown-pdf/template-codex", () => ({ prepareMdPdfTemplateCodex: capture("template-bundle"), rebindPreparedMdPdfTemplateCodexArtifact() {}, writePreparedMdPdfTemplateCodexBundle() {} }));
      mock.module("./src/cli/markdown-pdf/project-codex", () => ({ prepareMdPdfProjectCodex: capture("project-bundle"), rebindMdPdfProjectCodexPreparedArtifact() {}, writePreparedMdPdfProjectCodexBundle() {} }));
      const { prepareMarkdownPdfCodexCandidate } = await import("./src/cli/interactive/markdown/codex-service");
      const runtime = { cwd: "/fixtures", stderr: {write() {}, isTTY: false} };
      const codexExecution = {model:"Model-A",provider:"Provider-A",reasoningEffort:"high"};
      const candidates = [];
      for (const artifact of ["profile", "template-bundle", "project-bundle"]) {
        candidates.push(await prepareMarkdownPdfCodexCandidate(runtime, {artifact, fontHints: []}, {codexExecution, timeoutMs: 120000}));
      }
      console.log(JSON.stringify({calls, candidates}));
    `;
    const result = spawnSync(process.execPath, ["-e", script], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.calls).toEqual(
      ["profile", "template-bundle", "project-bundle"].map((artifact) => ({
        artifact,
        execution: { model: "Model-A", provider: "Provider-A", reasoningEffort: "high" },
        timeoutMs: 120000,
      })),
    );
    expect(JSON.stringify(output.candidates)).not.toContain("codexExecution");
    expect(JSON.stringify(output.candidates)).not.toContain("Provider-A");
  });

  test("a new default session does not retain previous Markdown selections", () => {
    const scenario = {
      mode: "run" as const,
      markdownPdfMocks: true,
      captureCodexExecution: true,
      selectQueue: [...recipesCodexSelections("profile"), "continue", "cancel"],
      inputQueue: [""],
      confirmQueue: [false, true],
    };
    const execution = {
      model: "Model-A",
      provider: "Provider-A",
      reasoningEffort: "high",
    } as const;
    const custom = runInteractiveHarness({ ...scenario, codexExecution: execution });
    const defaults = runInteractiveHarness(scenario);
    expect(custom.markdownPdfCodexPrepareCalls[0]?.codexExecution).toEqual(execution);
    expect(defaults.markdownPdfCodexPrepareCalls[0]?.codexExecution).toEqual({
      reasoningEffort: "low",
    });
  });
});
