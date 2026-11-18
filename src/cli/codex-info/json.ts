import type { CodexInfoReport } from "./report";
import { serializeCliJson } from "../json";

export function serializeCodexInfoReport(report: CodexInfoReport): string {
  return serializeCliJson(report);
}
