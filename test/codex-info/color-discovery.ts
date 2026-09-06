import type { CodexDiscovery } from "../../src/adapters/codex/discovery/types";

export const discovery: CodexDiscovery = {
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
