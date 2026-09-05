import { printLine } from "../actions/shared";
import type { CliRuntime } from "../types";
import type { CodexInfoReport, CodexModelInfo } from "./report";

/** Escape controls, including bidi overrides, before interpolating remote strings. */
function safe(value: string): string {
  return value.replace(
    /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu,
    (character) => `\\u${character.codePointAt(0)!.toString(16).padStart(4, "0")}`,
  );
}

function value(value: string | null, missing = "unknown"): string {
  return value === null ? missing : safe(value);
}

function markers(model: CodexModelInfo): string {
  return [
    model.isConfigured ? "configured" : null,
    model.isRecommended ? "catalog recommended" : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function renderCodexInfoReport(
  runtime: CliRuntime,
  report: CodexInfoReport,
  options: { details?: boolean } = {},
): void {
  const lines: string[] = [];
  const line = (text = "") => lines.push(text);
  line(`Codex ${report.view === "summary" ? "information" : report.view}`);
  line();
  line(`Configured model: ${value(report.configured.model, "unspecified")}`);
  line(`Configured provider: ${value(report.configured.provider, "unspecified")}`);
  line(`Helper reasoning default: ${safe(report.helperReasoningDefault)}`);
  if (report.catalogRecommendedModelIds !== null) {
    line(
      `Catalog recommended model: ${report.catalogRecommendedModelIds.map(safe).join(", ") || "none reported"}`,
    );
  }
  if (options.details) {
    line(`Configured reasoning effort: ${value(report.configured.reasoningEffort, "unspecified")}`);
    line();
    line("Configuration context for this invocation:");
    line(`  Working directory: ${safe(report.context.cwd)}`);
    line(`  Codex home: ${safe(report.context.codexHome)}`);
    line(`  Codex home source: ${safe(report.context.codexHomeSource)}`);
    line(`  Codex version: ${safe(report.context.codexVersion)}`);
  }
  line();
  line(`Provider coverage: ${safe(report.providerCoverage)}`);
  line(safe(report.providerCoverageDetail));
  if (report.view === "providers") {
    line();
    line("Providers (listing does not verify credentials or request support):");
    if (report.providers.length === 0) line("  No configured provider definitions reported.");
    for (const provider of report.providers) {
      line(
        `  ${safe(provider.id)} | source: ${provider.sources.map(safe).join(", ")}${provider.isConfigured ? " | configured" : ""}`,
      );
      if (options.details) line(`    Display name: ${value(provider.displayName)}`);
    }
    if (
      report.configured.provider !== null &&
      !report.providers.some((provider) => provider.isConfigured)
    ) {
      line(
        `  Configured provider ${safe(report.configured.provider)} is not listed by these sources.`,
      );
    }
  }
  if (report.models !== null) {
    line();
    line(
      "Codex-reported catalog metadata (picker-visible); entries do not establish support by the configured provider.",
    );
    if (report.configured.model !== null && !report.models.some((model) => model.isConfigured)) {
      line(
        `Configured model ${safe(report.configured.model)} is unlisted; capabilities are unknown.`,
      );
    }
    if (report.view === "models") {
      if (report.models.length === 0) line("No picker-visible models reported.");
      for (const model of report.models) {
        const selection = markers(model);
        line();
        line(`${safe(model.id)}${selection ? ` [${selection}]` : ""}`);
        line(
          `  Supported reasoning efforts: ${model.supportedReasoningEfforts?.map((effort) => safe(effort.effort)).join(", ") ?? "unknown"}`,
        );
        if (options.details) {
          line(`  Model: ${safe(model.model)}`);
          line(`  Display name: ${value(model.displayName)}`);
          line(`  Description: ${value(model.description)}`);
          line(`  Input modalities: ${model.inputModalities?.map(safe).join(", ") || "unknown"}`);
          line(`  Catalog reasoning default: ${value(model.catalogReasoningDefault)}`);
          for (const effort of model.supportedReasoningEfforts ?? []) {
            line(`    ${safe(effort.effort)}: ${value(effort.description)}`);
          }
        }
      }
    }
  }
  printLine(runtime.stdout, lines.join("\n"));
}
