import type { CodexInfoView } from "../../adapters/codex/discovery/types";
import type { discoverCodexInfo } from "../../adapters/codex/discovery";
import { buildCodexInfoReport } from "../codex-info/report";
import { renderCodexInfoReport } from "../codex-info/render";
import { serializeCodexInfoReport } from "../codex-info/json";
import { CliError } from "../errors";
import type { CliRuntime } from "../types";

export interface CodexInfoOptions {
  view?: CodexInfoView;
  details?: boolean;
  json?: boolean;
  discover?: typeof discoverCodexInfo;
}

export async function actionCodexInfo(
  runtime: CliRuntime,
  options: CodexInfoOptions = {},
): Promise<void> {
  const env = { ...process.env };
  const view = options.view ?? "summary";
  if (!["summary", "models", "providers"].includes(view) || (options.details && options.json)) {
    throw new CliError("Invalid Codex information view or conflicting output options.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  const discover =
    options.discover ?? (await import("../../adapters/codex/discovery")).discoverCodexInfo;
  const discovery = await discover({ cwd: runtime.cwd, view, env });
  const report = buildCodexInfoReport(discovery, view);
  if (options.json) {
    runtime.stdout.write(`${serializeCodexInfoReport(report)}\n`);
  } else {
    renderCodexInfoReport(runtime, report, { details: options.details });
  }
}
