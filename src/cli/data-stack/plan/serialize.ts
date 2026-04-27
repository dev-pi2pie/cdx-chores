import { orderDataStackPlanArtifact } from "./parse";
import type { DataStackPlanArtifact } from "./types";

export function serializeDataStackPlanArtifact(artifact: DataStackPlanArtifact): string {
  return `${JSON.stringify(orderDataStackPlanArtifact(artifact), null, 2)}\n`;
}
