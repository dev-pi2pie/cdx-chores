import { describe, expect, test } from "bun:test";

import { actionCodexInfo } from "../../src/cli/actions/codex-info";
import type {
  CodexDiscovery,
  CodexDiscoveryOptions,
} from "../../src/adapters/codex/discovery/types";
import { createCapturedRuntime } from "../helpers/cli-test-utils";

const discovery: CodexDiscovery = {
  context: {
    cwd: "/fixtures/work",
    codexVersion: "0.153.4",
    codexHome: "/fixtures/home",
    codexHomeSource: "environment",
  },
  config: {
    model: "Model-A",
    model_provider: "proxy",
    model_providers: {
      proxy: { name: "Company proxy", experimental_bearer_token: "private-secret" },
    },
  },
  models: [{ id: "Model-A", model: "Model-A", supportedReasoningEfforts: [], isDefault: true }],
};

describe("Codex information action", () => {
  test("JSON escapes terminal controls while preserving parsed Unicode values", async () => {
    const { runtime, stdout } = createCapturedRuntime();
    const hostile = "name\u009d8;;https://example.invalid\u009c\u202e\u2028\u2029\u{e0001}";
    await actionCodexInfo(runtime, {
      view: "providers",
      json: true,
      discover: async () => ({
        ...discovery,
        config: { model_providers: { proxy: { name: hostile } } },
        models: null,
      }),
    });
    expect(stdout.text).not.toMatch(/[\u007f-\u009f\p{Cf}\p{Zl}\p{Zp}]/u);
    expect(JSON.parse(stdout.text).providers[0].displayName).toBe(hostile);
    expect(stdout.text).toContain("\\udb40\\udc01");
  });
  test.each(["summary", "models", "providers"] as const)(
    "%s builds JSON from one scoped discovery",
    async (view) => {
      const { runtime, stdout } = createCapturedRuntime({ cwd: "/fixtures/work" });
      const calls: CodexDiscoveryOptions[] = [];
      await actionCodexInfo(runtime, {
        view,
        json: true,
        discover: async (options) => {
          calls.push(options);
          return { ...discovery, models: view === "providers" ? null : discovery.models };
        },
      });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({ cwd: runtime.cwd, view });
      const report = JSON.parse(stdout.text);
      expect(report.schemaVersion).toBe(1);
      expect(report.view).toBe(view);
      expect(report.providerCoverage).toBe("configured-only");
      expect(report.configured.provider).toBe("proxy");
      expect(report.helperReasoningDefault).toBe("low");
      expect(report.models === null).toBe(view === "providers");
      expect(stdout.text).not.toContain("private-secret");
    },
  );
  test("writes no report when required discovery fails", async () => {
    const { runtime, stdout } = createCapturedRuntime();
    await expect(
      actionCodexInfo(runtime, {
        json: true,
        discover: async () => {
          throw new Error("Codex discovery request failed.");
        },
      }),
    ).rejects.toThrow("discovery request failed");
    expect(stdout.text).toBe("");
  });
  test("validates conflicting programmatic options before discovery", async () => {
    const { runtime } = createCapturedRuntime();
    let called = false;
    await expect(
      actionCodexInfo(runtime, {
        details: true,
        json: true,
        discover: async () => {
          called = true;
          return discovery;
        },
      }),
    ).rejects.toThrow("conflicting output");
    expect(called).toBe(false);
  });
});
