import type { HarnessRunnerContext } from "../../context";
import type { DataQueryWorkspaceRelationScenario } from "./types";

function buildDefaultWorkspaceRelation(relation: {
  alias?: unknown;
  source?: unknown;
}): DataQueryWorkspaceRelationScenario {
  const alias = String(relation.alias ?? "");
  const source = String(relation.source ?? "");
  const key = `${alias}:${source}`.toLowerCase();

  if (key.includes("entry")) {
    return {
      alias,
      columns: [
        { name: "entry_id", type: "BIGINT" },
        { name: "hours", type: "DOUBLE" },
      ],
      sampleRows: [{ entry_id: "1", hours: "7.5" }],
      source,
      truncated: false,
    };
  }

  if (key.includes("active")) {
    return {
      alias,
      columns: [
        { name: "id", type: "BIGINT" },
        { name: "name", type: "VARCHAR" },
        { name: "is_active", type: "BOOLEAN" },
      ],
      sampleRows: [{ id: "1", name: "Ada", is_active: "true" }],
      source,
      truncated: false,
    };
  }

  return {
    alias,
    columns: [
      { name: "id", type: "BIGINT" },
      { name: "name", type: "VARCHAR" },
    ],
    sampleRows: [{ id: "1", name: "Ada" }],
    source,
    truncated: false,
  };
}

export function getScenarioWorkspaceIntrospection(
  context: HarnessRunnerContext,
  relations: Array<{ alias?: unknown; source?: unknown }>,
): Record<string, unknown> {
  const nextIntrospection = context.scenario.dataQueryWorkspaceIntrospectionQueue?.shift();
  if (nextIntrospection) {
    return nextIntrospection;
  }

  const configuredRelations = Array.isArray(
    context.scenario.dataQueryWorkspaceIntrospection?.relations,
  )
    ? (context.scenario.dataQueryWorkspaceIntrospection
        ?.relations as DataQueryWorkspaceRelationScenario[])
    : [];

  return {
    kind: "workspace",
    relations: relations.map((relation, index) => {
      const configured = configuredRelations[index];
      const fallback = buildDefaultWorkspaceRelation(relation);
      return {
        alias: String(configured?.alias ?? relation.alias ?? ""),
        columns: configured?.columns ?? fallback.columns ?? [],
        sampleRows: configured?.sampleRows ?? fallback.sampleRows ?? [],
        source: String(configured?.source ?? relation.source ?? ""),
        truncated: Boolean(configured?.truncated ?? fallback.truncated),
      };
    }),
  };
}
