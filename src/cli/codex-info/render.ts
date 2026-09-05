import { printLine } from "../actions/shared";
import { getCliColors } from "../colors";
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
  const pc = getCliColors(runtime, runtime.stdout);
  const lines: string[] = [];
  const line = (text = "") => lines.push(text);
  line(pc.bold(pc.cyan(`Codex ${report.view === "summary" ? "information" : report.view}`)));
  line();
  if (report.view === "summary") {
    line(`Configured model: ${pc.bold(value(report.configured.model, "unspecified"))}`);
  }
  line(`Configured provider: ${pc.bold(value(report.configured.provider, "unspecified"))}`);
  if (report.view === "summary") {
    line(`Helper reasoning default: ${safe(report.helperReasoningDefault)}`);
    line(
      `Catalog recommended model: ${report.catalogRecommendedModelIds?.map((id) => pc.bold(safe(id))).join(", ") || "none reported"}`,
    );
    if (options.details) {
      line(
        `Configured reasoning effort: ${value(report.configured.reasoningEffort, "unspecified")}`,
      );
    }
    line();
    line("Provider coverage: configured definitions only; built-ins not enumerated.");
  }
  if (report.view === "providers") {
    line("Source: configured definitions; built-ins not enumerated.");
    line("Credentials and request support are not verified.");
    line();
    if (report.providers.length === 0) line("No configured provider definitions reported.");
    for (const provider of report.providers) {
      line(
        `${pc.bold(safe(provider.id))}${provider.isConfigured ? ` ${pc.cyan("[configured]")}` : ""}`,
      );
      if (options.details && provider.displayName) {
        line(`  Display name: ${safe(provider.displayName)}`);
      }
    }
    if (
      report.configured.provider !== null &&
      !report.providers.some((provider) => provider.isConfigured)
    ) {
      line(
        `Configured provider ${safe(report.configured.provider)} is unlisted; absence does not imply lack of support.`,
      );
    }
  }
  if (report.models !== null) {
    line("Codex catalog metadata (picker-visible); provider support is not verified.");
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
        line(`${pc.bold(safe(model.id))}${selection ? ` ${pc.cyan(`[${selection}]`)}` : ""}`);
        line(
          `  Reasoning efforts: ${model.supportedReasoningEfforts?.map((effort) => safe(effort.effort)).join(", ") ?? "unknown"}`,
        );
        if (options.details) {
          if (model.model !== model.id) line(`  Model: ${safe(model.model)}`);
          if (model.displayName) line(`  Display name: ${safe(model.displayName)}`);
          if (model.description) line(`  Description: ${safe(model.description)}`);
          line(`  Input modalities: ${model.inputModalities?.map(safe).join(", ") || "unknown"}`);
          line(`  Catalog reasoning default: ${value(model.catalogReasoningDefault)}`);
          for (const effort of model.supportedReasoningEfforts ?? []) {
            if (effort.description) {
              line(`    ${safe(effort.effort)}: ${safe(effort.description)}`);
            }
          }
        }
      }
    }
  }
  if (options.details) {
    line();
    line(pc.bold(pc.cyan("Invocation context:")));
    line(`  Working directory: ${safe(report.context.cwd)}`);
    line(`  Codex home: ${safe(report.context.codexHome)}`);
    line(`  Codex home source: ${safe(report.context.codexHomeSource)}`);
    line(`  Codex version: ${safe(report.context.codexVersion)}`);
  }
  printLine(runtime.stdout, lines.join("\n"));
}
