import { displayPath, printLine } from "../../../actions/shared";
import { getCliColors } from "../../../colors";
import type { DataQueryInputFormat, DataQuerySourceIntrospection } from "../../../duckdb/query";
import type { CliRuntime } from "../../../types";

export function renderIntrospectionSummary(
  runtime: CliRuntime,
  options: {
    format: DataQueryInputFormat;
    inputPath: string;
    introspection: DataQuerySourceIntrospection;
  },
): void {
  const pc = getCliColors(runtime);
  const lines = [
    `${pc.bold(pc.cyan("Input"))}: ${pc.white(displayPath(runtime, options.inputPath))}`,
    `${pc.bold(pc.cyan("Format"))}: ${pc.white(options.format)}`,
    ...(options.introspection.selectedSource
      ? [`${pc.bold(pc.cyan("Source"))}: ${pc.white(options.introspection.selectedSource)}`]
      : []),
    ...(options.introspection.selectedRange
      ? [`${pc.bold(pc.cyan("Range"))}: ${pc.white(options.introspection.selectedRange)}`]
      : []),
    ...(options.introspection.selectedBodyStartRow !== undefined
      ? [
          `${pc.bold(pc.cyan("Body start row"))}: ${pc.white(String(options.introspection.selectedBodyStartRow))}`,
        ]
      : []),
    ...(options.introspection.selectedHeaderRow !== undefined
      ? [
          `${pc.bold(pc.cyan("Header row"))}: ${pc.white(String(options.introspection.selectedHeaderRow))}`,
        ]
      : []),
    `${pc.bold(pc.cyan("Schema"))}:`,
    ...(options.introspection.columns.length > 0
      ? options.introspection.columns.map(
          (column) => `- ${pc.bold(column.name)}: ${pc.dim(column.type)}`,
        )
      : [`- ${pc.dim("(no columns available)")}`]),
    `${pc.bold(pc.cyan("Sample Rows"))}:`,
    ...(options.introspection.sampleRows.length > 0
      ? options.introspection.sampleRows.map(
          (row, index) => `- ${pc.dim(`${index + 1}.`)} ${pc.white(JSON.stringify(row))}`,
        )
      : [`- ${pc.dim("(no sample rows available)")}`]),
  ];

  for (const line of lines) {
    printLine(runtime.stderr, line);
  }
}
