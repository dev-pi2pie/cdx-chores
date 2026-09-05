import { describe, expect, test } from "bun:test";

import type { CodexDiscovery } from "../../src/adapters/codex/discovery/types";
import { buildCodexInfoReport } from "../../src/cli/codex-info/report";

function discovery(
  config: Record<string, unknown> = {},
  models: unknown[] | null = [],
): CodexDiscovery {
  return {
    context: {
      cwd: "/project",
      codexVersion: "0.153.4",
      codexHome: "/home/codex",
      codexHomeSource: "environment",
    },
    config,
    models,
  };
}

const model = {
  id: "picker-id",
  model: "backend-model",
  isDefault: true,
  displayName: "Example model",
  description: "Synthetic catalog entry",
  inputModalities: ["text", "image"],
  defaultReasoningEffort: "medium",
  supportedReasoningEfforts: [{ reasoningEffort: "new-effort", description: "Advertised only" }],
};

describe("Codex information report", () => {
  test("keeps configuration, catalog recommendations, and helper defaults distinct", () => {
    const report = buildCodexInfoReport(
      discovery(
        { model: "unlisted-model", model_provider: "proxy", model_reasoning_effort: "high" },
        [model],
      ),
      "models",
    );
    expect(report.configured).toEqual({
      model: "unlisted-model",
      provider: "proxy",
      reasoningEffort: "high",
    });
    expect(report.helperReasoningDefault).toBe("low");
    expect(report.catalogRecommendedModelIds).toEqual(["picker-id"]);
    expect(report.models).toEqual([
      {
        id: "picker-id",
        model: "backend-model",
        displayName: "Example model",
        description: "Synthetic catalog entry",
        inputModalities: ["text", "image"],
        supportedReasoningEfforts: [{ effort: "new-effort", description: "Advertised only" }],
        catalogReasoningDefault: "medium",
        isConfigured: false,
        isRecommended: true,
      },
    ]);
    expect(report.catalogSource).toBe("codex");
    expect(report.catalogScope).toBe("picker-visible");
  });

  test("matches configured model against model slug rather than picker ID", () => {
    expect(
      buildCodexInfoReport(discovery({ model: "backend-model" }, [model]), "models").models?.[0]
        ?.isConfigured,
    ).toBe(true);
    expect(
      buildCodexInfoReport(discovery({ model: "picker-id" }, [model]), "models").models?.[0]
        ?.isConfigured,
    ).toBe(false);
  });

  test("curates provider fields and sorts exact case-sensitive IDs", () => {
    const report = buildCodexInfoReport(
      discovery({
        model_provider: "proxy",
        secret: "PRIVATE",
        model_providers: {
          proxy: {
            name: "Proxy",
            base_url: "PRIVATE",
            env_key: "PRIVATE",
            http_headers: { Authorization: "PRIVATE" },
          },
          Proxy: {},
          z: { name: null },
        },
      }),
      "providers",
    );
    expect(report.providers).toEqual([
      { id: "Proxy", displayName: null, sources: ["configured"], isConfigured: false },
      { id: "proxy", displayName: "Proxy", sources: ["configured"], isConfigured: true },
      { id: "z", displayName: null, sources: ["configured"], isConfigured: false },
    ]);
    expect(JSON.stringify(report)).not.toContain("PRIVATE");
    expect(report.providerCoverage).toBe("configured-only");
    expect(report.providerCoverageDetail).toContain("built-in provider IDs are not enumerated");
  });

  test("keeps an unlisted provider selection without inventing a definition", () => {
    const report = buildCodexInfoReport(
      discovery({ model_provider: "builtin-example" }, null),
      "providers",
    );
    expect(report.configured.provider).toBe("builtin-example");
    expect(report.providers).toEqual([]);
  });

  test("provider output has null model fields even if caller supplied catalog data", () => {
    const report = buildCodexInfoReport(discovery({}, [model]), "providers");
    expect(report.models).toBeNull();
    expect(report.catalogRecommendedModelIds).toBeNull();
    expect(report.catalogSource).toBeNull();
    expect(report.catalogScope).toBeNull();
  });

  test("empty successful catalog differs from not-requested catalog", () => {
    const report = buildCodexInfoReport(discovery(), "summary");
    expect(report.models).toEqual([]);
    expect(report.catalogRecommendedModelIds).toEqual([]);
    expect(report.configured).toEqual({ model: null, provider: null, reasoningEffort: null });
    expect(() => buildCodexInfoReport(discovery({}, null), "summary")).toThrow(
      "invalid report metadata",
    );
  });

  test.each([undefined, null, []].map((efforts) => ({ efforts })))(
    "missing or empty efforts remain unknown: %p",
    ({ efforts }) => {
      const report = buildCodexInfoReport(
        discovery({}, [
          { id: "a", model: "a", isDefault: false, supportedReasoningEfforts: efforts },
        ]),
        "models",
      );
      expect(report.models?.[0]).toEqual({
        id: "a",
        model: "a",
        isConfigured: false,
        isRecommended: false,
        displayName: null,
        description: null,
        inputModalities: null,
        supportedReasoningEfforts: null,
        catalogReasoningDefault: null,
      });
    },
  );

  test("retains multiple recommendations and rejects conflicting duplicate IDs", () => {
    const report = buildCodexInfoReport(
      discovery({}, [model, { ...model, id: "second" }]),
      "models",
    );
    expect(report.catalogRecommendedModelIds).toEqual(["picker-id", "second"]);
    expect(() =>
      buildCodexInfoReport(discovery({}, [model, { ...model, isDefault: false }]), "models"),
    ).toThrow("invalid report metadata");
  });

  test("provider selection need not change catalog metadata", () => {
    const before = buildCodexInfoReport(discovery({}, [model]), "models");
    const after = buildCodexInfoReport(discovery({ model_provider: "proxy" }, [model]), "models");
    expect(before.models).toEqual(after.models);
    expect(before.configured.provider).toBeNull();
    expect(after.configured.provider).toBe("proxy");
  });

  test.each([
    { model: 3 },
    { model_provider: [] },
    { model_reasoning_effort: {} },
    { model_providers: [] },
    { model_providers: { proxy: null } },
    { model_providers: { proxy: { name: 3 } } },
  ])("rejects malformed curated configuration fields without disclosing input: %p", (config) => {
    expect(() => buildCodexInfoReport(discovery(config), "providers")).toThrow(
      "Codex discovery returned invalid report metadata.",
    );
  });

  test.each([
    null,
    {},
    { ...model, id: " " },
    { ...model, isDefault: "yes" },
    { ...model, description: {} },
    { ...model, inputModalities: [1] },
    { ...model, supportedReasoningEfforts: false },
    { ...model, supportedReasoningEfforts: [{ reasoningEffort: 1 }] },
  ])("rejects malformed curated model fields: %p", (entry) => {
    expect(() => buildCodexInfoReport(discovery({}, [entry]), "models")).toThrow(
      "invalid report metadata",
    );
  });

  test("does not retain raw context or model extension fields", () => {
    const input = discovery({}, [{ ...model, secret: "PRIVATE" }]);
    Object.assign(input.context, { secret: "PRIVATE" });
    const report = buildCodexInfoReport(input, "summary");
    expect(JSON.stringify(report)).not.toContain("PRIVATE");
    input.context.codexHome = "/changed";
    expect(report.context.codexHome).toBe("/home/codex");
  });
});
