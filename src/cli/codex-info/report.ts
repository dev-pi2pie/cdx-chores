import type {
  CodexDiscovery,
  CodexDiscoveryContext,
  CodexInfoView,
} from "../../adapters/codex/discovery/types";
import { resolveCodexExecution } from "../../utils/codex-execution";

export interface CodexModelInfo {
  id: string;
  model: string;
  displayName: string | null;
  description: string | null;
  inputModalities: string[] | null;
  supportedReasoningEfforts: { effort: string; description: string | null }[] | null;
  catalogReasoningDefault: string | null;
  isConfigured: boolean;
  isRecommended: boolean;
}

export interface CodexProviderInfo {
  id: string;
  displayName: string | null;
  sources: "configured"[];
  isConfigured: boolean;
}

export interface CodexInfoReport {
  schemaVersion: 1;
  view: CodexInfoView;
  context: CodexDiscoveryContext;
  configured: { model: string | null; provider: string | null; reasoningEffort: string | null };
  helperReasoningDefault: string;
  providerCoverage: "configured-only";
  providerCoverageDetail: string;
  providers: CodexProviderInfo[];
  catalogSource: "codex" | null;
  catalogScope: "picker-visible" | null;
  catalogRecommendedModelIds: string[] | null;
  models: CodexModelInfo[] | null;
}

function invalidMetadata(): never {
  throw new Error("Codex discovery returned invalid report metadata.");
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidMetadata();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string") invalidMetadata();
  return value;
}

function identifier(value: unknown): string {
  const result = text(value);
  if (result.trim().length === 0) invalidMetadata();
  return result;
}

function nullableText(value: unknown): string | null {
  return value === undefined || value === null ? null : text(value);
}

function nullableIdentifier(value: unknown): string | null {
  return value === undefined || value === null ? null : identifier(value);
}

function optionalStrings(value: unknown): string[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) invalidMetadata();
  return value.map(text);
}

function modelInfo(value: unknown, configuredModel: string | null): CodexModelInfo {
  const raw = record(value);
  const id = identifier(raw.id);
  const model = identifier(raw.model);
  if (typeof raw.isDefault !== "boolean") invalidMetadata();
  const efforts = raw.supportedReasoningEfforts;
  if (efforts !== undefined && efforts !== null && !Array.isArray(efforts)) invalidMetadata();
  return {
    id,
    model,
    displayName: nullableText(raw.displayName),
    description: nullableText(raw.description),
    inputModalities: optionalStrings(raw.inputModalities),
    supportedReasoningEfforts:
      Array.isArray(efforts) && efforts.length > 0
        ? efforts.map((value) => {
            const effort = record(value);
            return {
              effort: identifier(effort.reasoningEffort),
              description: nullableText(effort.description),
            };
          })
        : null,
    catalogReasoningDefault: nullableIdentifier(raw.defaultReasoningEffort),
    isConfigured: configuredModel !== null && configuredModel === model,
    isRecommended: raw.isDefault,
  };
}

/** Curate protocol fields explicitly: raw configuration must never reach output. */
export function buildCodexInfoReport(
  discovery: CodexDiscovery,
  view: CodexInfoView,
): CodexInfoReport {
  const config = record(discovery.config);
  const configured = {
    model: nullableIdentifier(config.model),
    provider: nullableIdentifier(config.model_provider),
    reasoningEffort: nullableIdentifier(config.model_reasoning_effort),
  };
  const definitions =
    config.model_providers === undefined || config.model_providers === null
      ? {}
      : record(config.model_providers);
  const providers = Object.keys(definitions)
    .sort()
    .map((id): CodexProviderInfo => {
      identifier(id);
      const definition = record(definitions[id]);
      return {
        id,
        displayName: nullableText(definition.name),
        sources: ["configured"],
        isConfigured: configured.provider === id,
      };
    });
  let models: CodexModelInfo[] | null = null;
  if (view !== "providers") {
    if (!Array.isArray(discovery.models)) invalidMetadata();
    const byId = new Map<string, CodexModelInfo>();
    for (const raw of discovery.models) {
      const model = modelInfo(raw, configured.model);
      if (byId.has(model.id)) invalidMetadata();
      byId.set(model.id, model);
    }
    models = [...byId.values()];
  }
  return {
    schemaVersion: 1,
    view,
    context: {
      cwd: discovery.context.cwd,
      codexVersion: discovery.context.codexVersion,
      codexHome: discovery.context.codexHome,
      codexHomeSource: discovery.context.codexHomeSource,
    },
    configured,
    helperReasoningDefault: resolveCodexExecution().reasoningEffort,
    providerCoverage: "configured-only",
    providerCoverageDetail:
      "Only configured provider definitions are listed; built-in provider IDs are not enumerated. Absence does not mean a provider is unsupported.",
    providers,
    catalogSource: models === null ? null : "codex",
    catalogScope: models === null ? null : "picker-visible",
    catalogRecommendedModelIds:
      models === null
        ? null
        : models.filter((model) => model.isRecommended).map((model) => model.id),
    models,
  };
}
