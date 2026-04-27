import { writeTextFileSafe } from "../../file-io";
import type { DataStackDiagnosticsResult } from "../../data-stack/diagnostics";
import { materializeDataStackRows } from "../../data-stack/materialize";
import type { PreparedDataStackExecution } from "../../data-stack/prepare";
import type { DataStackOutputFormat } from "../../data-stack/types";
import type { CliRuntime } from "../../types";
import { renderDataStackOutputSummary } from "./reporting";

export async function writePreparedDataStackOutput(
  runtime: CliRuntime,
  options: {
    diagnostics?: DataStackDiagnosticsResult;
    outputFormat: DataStackOutputFormat;
    outputPath: string;
    overwrite?: boolean;
    prepared: PreparedDataStackExecution;
    uniqueBy?: readonly string[];
  },
): Promise<void> {
  const text = materializeDataStackRows({
    format: options.outputFormat,
    header: options.prepared.header,
    rows: options.prepared.rows,
  });

  await writeTextFileSafe(options.outputPath, text, { overwrite: options.overwrite });
  renderDataStackOutputSummary(runtime, options);
}
