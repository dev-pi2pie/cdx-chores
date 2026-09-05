import { describe, expect, test } from "bun:test";

import type { CodexDiscovery, CodexInfoView } from "../../src/adapters/codex/discovery/types";
import { buildCodexInfoReport } from "../../src/cli/codex-info/report";
import { renderCodexInfoReport } from "../../src/cli/codex-info/render";
import { createCapturedRuntime } from "../helpers/cli-test-utils";

function render(view: CodexInfoView, details = false, patch: Partial<CodexDiscovery> = {}): string {
  const discovery: CodexDiscovery = {
    context: {
      cwd: "/project",
      codexVersion: "0.153.4",
      codexHome: "/custom/codex",
      codexHomeSource: "environment",
    },
    config: {
      model: "model-a",
      model_provider: "proxy",
      model_reasoning_effort: "high",
      model_providers: { proxy: { name: "Example proxy", api_key: "PRIVATE" } },
    },
    models: [
      {
        id: "model-a",
        model: "model-a",
        displayName: "Model A",
        description: "Example",
        isDefault: true,
        supportedReasoningEfforts: [{ reasoningEffort: "medium", description: "Some thought" }],
        defaultReasoningEffort: "medium",
        inputModalities: ["text"],
      },
    ],
    ...patch,
  };
  const { runtime, stdout, stderr } = createCapturedRuntime({ colorEnabled: false });
  renderCodexInfoReport(runtime, buildCodexInfoReport(discovery, view), { details });
  expect(stderr.text).toBe("");
  expect(stdout.text).not.toContain("PRIVATE");
  return stdout.text;
}

describe("Codex information human output", () => {
  test("summary distinguishes configuration, recommendation, and helper effort", () => {
    const output = render("summary");
    expect(output).toContain("Configured model: model-a");
    expect(output).toContain("Configured provider: proxy");
    expect(output).toContain("Catalog recommended model: model-a");
    expect(output).toContain("Helper reasoning default: low");
    expect(output).toContain("Provider coverage: configured-only");
    expect(output).toContain("built-in provider IDs are not enumerated");
    expect(output).not.toContain("Working directory:");
  });

  test.each(["summary", "models", "providers"] as const)(
    "details disclose invocation context for %s",
    (view) => {
      const output = render(view, true);
      expect(output).toContain("Working directory: /project");
      expect(output).toContain("Codex home: /custom/codex");
      expect(output).toContain("Codex home source: environment");
      expect(output).toContain("Codex version: 0.153.4");
      expect(output).toContain("Configured reasoning effort: high");
    },
  );

  test.each([false, true])(
    "models show provider context and catalog qualification, details=%s",
    (details) => {
      const output = render("models", details);
      expect(output).toContain("Configured provider: proxy");
      expect(output).toContain("Codex-reported catalog metadata (picker-visible)");
      expect(output).toContain("do not establish support by the configured provider");
      expect(output).toContain("model-a [configured, catalog recommended]");
      expect(output).toContain("Supported reasoning efforts: medium");
      if (details) {
        expect(output).toContain("Catalog reasoning default: medium");
        expect(output).toContain("Display name: Model A");
        expect(output).toContain("Description: Example");
        expect(output).toContain("Input modalities: text");
        expect(output).toContain("medium: Some thought");
      } else {
        expect(output).not.toContain("Some thought");
      }
    },
  );

  test("unknown metadata and unlisted configuration are explicit", () => {
    const output = render("models", true, {
      config: { model: "custom" },
      models: [{ id: "other", model: "other", isDefault: false, supportedReasoningEfforts: [] }],
    });
    expect(output).toContain("Configured provider: unspecified");
    expect(output).toContain("Catalog recommended model: none reported");
    expect(output).toContain("Configured model custom is unlisted; capabilities are unknown");
    expect(output).toContain("Supported reasoning efforts: unknown");
    expect(output).toContain("Catalog reasoning default: unknown");
    expect(output).not.toContain("Supported reasoning efforts: unsupported");
  });

  test.each([false, true])(
    "providers omit unrequested model catalog sections, details=%s",
    (details) => {
      const output = render("providers", details, { models: null });
      expect(output).toContain("proxy | source: configured | configured");
      expect(output).toContain("listing does not verify credentials or request support");
      expect(output).not.toContain("Catalog recommended");
      expect(output).not.toContain("picker-visible");
      if (details) expect(output).toContain("Display name: Example proxy");
    },
  );

  test("empty sources retain selected provider and coverage limitation", () => {
    const output = render("providers", false, { config: { model_provider: "builtin-example" } });
    expect(output).toContain("No configured provider definitions reported");
    expect(output).toContain("Configured provider builtin-example is not listed by these sources");
    expect(output).toContain("Absence does not mean a provider is unsupported");
  });

  test("empty catalog prints a successful empty state", () => {
    expect(render("models", false, { models: [], config: {} })).toContain(
      "No picker-visible models reported",
    );
  });

  test("escapes terminal controls and bidi formatting in remote/configured strings", () => {
    const malicious = "name\x1b[2J\nforged\t\r\u009b\u202e\u2028";
    const output = render("models", true, {
      config: { model_provider: malicious },
      models: [
        {
          id: malicious,
          model: malicious,
          isDefault: true,
          description: malicious,
          supportedReasoningEfforts: [{ reasoningEffort: malicious, description: malicious }],
        },
      ],
    });
    expect(output).not.toContain("\x1b");
    expect(output).not.toContain("\u009b");
    expect(output).not.toContain("\u202e");
    expect(output).toContain("name\\u001b[2J\\u000aforged\\u0009\\u000d\\u009b\\u202e\\u2028");
    expect(output).not.toContain("\nforged");
  });
});
