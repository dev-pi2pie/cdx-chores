import { randomUUID } from "node:crypto";

import type { CliRuntime } from "../types";
import { formatUtcFileDateTimeISO } from "../../utils/datetime";
import type { DataStackOutputFormat } from "./types";

export function createDataStackDefaultOutputPath(
  runtime: CliRuntime,
  outputFormat: DataStackOutputFormat,
): string {
  return `data-stack-${formatUtcFileDateTimeISO(runtime.now())}-${randomUUID().slice(0, 8)}.${outputFormat}`;
}
