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
  const context = `

Invocation context:
  Working directory: /project
  Codex home: /custom/codex
  Codex home source: environment
  Codex version: 0.153.4`;

  test.each([false, true])("concise summary layout, details=%s", (details) => {
    expect(render("summary", details)).toBe(`Codex information

Configured model: model-a
Configured provider: proxy
Helper reasoning default: low
Catalog recommended model: model-a${details ? "\nConfigured reasoning effort: high" : ""}

Provider coverage: configured definitions only; built-ins not enumerated.
Codex catalog metadata (picker-visible); provider support is not verified.${details ? context : ""}
`);
  });

  test.each([false, true])("concise models layout, details=%s", (details) => {
    expect(render("models", details)).toBe(`Codex models

Configured provider: proxy
Codex catalog metadata (picker-visible); provider support is not verified.

model-a [configured, catalog recommended]
  Reasoning efforts: medium${
    details
      ? `
  Display name: Model A
  Description: Example
  Input modalities: text
  Catalog reasoning default: medium
    medium: Some thought${context}`
      : ""
  }
`);
  });

  test.each([false, true])("concise providers layout, details=%s", (details) => {
    expect(render("providers", details)).toBe(`Codex providers

Configured provider: proxy
Source: configured definitions; built-ins not enumerated.
Credentials and request support are not verified.

proxy [configured]${details ? `\n  Display name: Example proxy${context}` : ""}
`);
  });

  test("summary distinguishes configuration, recommendation, and helper effort", () => {
    const output = render("summary");
    expect(output).toContain("Configured model: model-a");
    expect(output).toContain("Configured provider: proxy");
    expect(output).toContain("Catalog recommended model: model-a");
    expect(output).toContain("Helper reasoning default: low");
    expect(output).toContain("Provider coverage: configured definitions only");
    expect(output).toContain("built-ins not enumerated");
    expect(output).not.toContain("Configured reasoning effort");
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
      if (view === "summary") expect(output).toContain("Configured reasoning effort: high");
      else expect(output).not.toContain("Configured reasoning effort");
    },
  );

  test.each([false, true])(
    "models show provider context and catalog qualification, details=%s",
    (details) => {
      const output = render("models", details);
      expect(output).toContain("Configured provider: proxy");
      expect(output).toContain("Codex catalog metadata (picker-visible)");
      expect(output).toContain("provider support is not verified");
      expect(output).toContain("model-a [configured, catalog recommended]");
      expect(output).toContain("Reasoning efforts: medium");
      expect(output).not.toContain("Helper reasoning");
      expect(output).not.toContain("Catalog recommended model:");
      expect(output).not.toContain("Provider coverage");
      expect(output).not.toContain("built-ins");
      expect(output).not.toContain("  Model: model-a");
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
    expect(output).toContain("Configured model custom is unlisted; capabilities are unknown");
    expect(output).toContain("Reasoning efforts: unknown");
    expect(output).toContain("Catalog reasoning default: unknown");
    expect(output).not.toContain("Reasoning efforts: unsupported");
  });

  test.each([false, true])(
    "providers omit unrequested model catalog sections, details=%s",
    (details) => {
      const output = render("providers", details, { models: null });
      expect(output).toContain("proxy [configured]");
      expect(output).toContain("Credentials and request support are not verified");
      expect(output).not.toContain("Configured model");
      expect(output).not.toContain("reasoning");
      expect(output).not.toContain("source: configured");
      expect(output).not.toContain("Catalog recommended");
      expect(output).not.toContain("picker-visible");
      if (details) expect(output).toContain("Display name: Example proxy");
    },
  );

  test("empty sources retain selected provider and coverage limitation", () => {
    const output = render("providers", false, { config: { model_provider: "builtin-example" } });
    expect(output).toContain("No configured provider definitions reported");
    expect(output).toContain("Configured provider builtin-example is unlisted");
    expect(output).toContain("absence does not imply lack of support");
  });

  test("details retain a model identifier when it differs from the catalog entry ID", () => {
    const output = render("models", true, {
      models: [{ id: "catalog-entry", model: "model-a", isDefault: false }],
    });
    expect(output).toContain(
      "catalog-entry [configured]\n  Reasoning efforts: unknown\n  Model: model-a",
    );
    expect(output).toContain("Input modalities: unknown");
    expect(output).toContain("Catalog reasoning default: unknown");
  });

  test.each([undefined, null, ""])("details omit absent optional prose (%s)", (optional) => {
    const modelOutput = render("models", true, {
      models: [
        {
          id: "model-a",
          model: "model-a",
          isDefault: false,
          displayName: optional,
          description: optional,
          supportedReasoningEfforts: [{ reasoningEffort: "low", description: optional }],
        },
      ],
    });
    expect(modelOutput).not.toContain("Display name:");
    expect(modelOutput).not.toContain("Description:");
    expect(modelOutput).not.toContain("    low:");
    expect(modelOutput).toContain("Reasoning efforts: low");
    expect(modelOutput).toContain("Catalog reasoning default: unknown");
    expect(
      render("providers", true, {
        config: { model_provider: "proxy", model_providers: { proxy: { name: optional } } },
      }),
    ).not.toContain("Display name:");
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
