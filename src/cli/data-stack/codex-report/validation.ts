import { CliError } from "../../errors";
import { normalizeDataStackSchemaOptions } from "../disclosure";
import {
  DATA_STACK_DUPLICATE_POLICY_VALUES,
  parseDataStackPlanArtifact,
  type DataStackDuplicatePolicy,
  type DataStackPlanArtifact,
} from "../plan";
import {
  DATA_STACK_CODEX_PATCH_PATHS,
  type DataStackCodexPatch,
  type DataStackCodexPatchPath,
  type DataStackCodexRecommendation,
} from "./types";

function ensureString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CliError(`Invalid data stack Codex report: ${context} must be a non-empty string.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return value.trim();
}

function ensureStringArray(
  value: unknown,
  context: string,
  options: { allowEmpty?: boolean } = {},
): string[] {
  if (!Array.isArray(value)) {
    throw new CliError(`Invalid data stack Codex patch: ${context} must be an array.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  const strings = value.map((item, index) => ensureString(item, `${context}[${index}]`));
  if (strings.length === 0 && options.allowEmpty !== true) {
    throw new CliError(`Invalid data stack Codex patch: ${context} cannot be empty.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  if (new Set(strings.map((item) => item.toLowerCase())).size !== strings.length) {
    throw new CliError(`Invalid data stack Codex patch: ${context} cannot contain duplicates.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return strings;
}

function ensurePatchPath(value: unknown): DataStackCodexPatchPath {
  if (
    typeof value === "string" &&
    (DATA_STACK_CODEX_PATCH_PATHS as readonly string[]).includes(value)
  ) {
    return value as DataStackCodexPatchPath;
  }
  throw new CliError(
    `Invalid data stack Codex patch: path must be one of: ${DATA_STACK_CODEX_PATCH_PATHS.join(", ")}.`,
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

function ensureDuplicatePolicy(value: unknown): DataStackDuplicatePolicy {
  if (
    typeof value === "string" &&
    (DATA_STACK_DUPLICATE_POLICY_VALUES as readonly string[]).includes(value)
  ) {
    return value as DataStackDuplicatePolicy;
  }
  throw new CliError(
    `Invalid data stack Codex patch: /duplicates/policy must be one of: ${DATA_STACK_DUPLICATE_POLICY_VALUES.join(", ")}.`,
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

function ensureSchemaMode(value: unknown): DataStackPlanArtifact["schema"]["mode"] {
  if (value === "strict" || value === "union-by-name") {
    return value;
  }
  throw new CliError(
    "Invalid data stack Codex patch: /schema/mode must be one of: strict, union-by-name.",
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

function assertKnownSchemaNames(
  plan: DataStackPlanArtifact,
  names: readonly string[],
  context: string,
): void {
  const available = new Set(plan.schema.includedNames);
  const unknown = names.filter((name) => !available.has(name));
  if (unknown.length > 0) {
    throw new CliError(
      `Invalid data stack Codex patch: ${context} contains unknown schema names: ${unknown.join(", ")}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
}

function assertKnownSchemaOrExcludedNames(
  plan: DataStackPlanArtifact,
  names: readonly string[],
  context: string,
): void {
  const available = new Set([...plan.schema.includedNames, ...plan.schema.excludedNames]);
  const unknown = names.filter((name) => !available.has(name));
  if (unknown.length > 0) {
    throw new CliError(
      `Invalid data stack Codex patch: ${context} contains unknown schema names: ${unknown.join(", ")}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
}

function assertPreservesExistingExcludedNames(
  plan: DataStackPlanArtifact,
  excludedNames: readonly string[],
): void {
  const nextExcludedNames = new Set(excludedNames);
  const removedNames = plan.schema.excludedNames.filter((name) => !nextExcludedNames.has(name));
  if (removedNames.length > 0) {
    throw new CliError(
      `Invalid data stack Codex patch: /schema/excludedNames must keep existing excluded schema names: ${removedNames.join(", ")}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
}

function assertExecutableSchemaPatch(
  plan: DataStackPlanArtifact,
  schema: DataStackPlanArtifact["schema"],
): void {
  normalizeDataStackSchemaOptions({
    excludeColumns: schema.excludedNames,
    noHeader: plan.input.headerMode === "no-header",
    schemaMode: schema.mode,
  });
}

function assertReplayableSchemaModePatch(
  plan: DataStackPlanArtifact,
  mode: DataStackPlanArtifact["schema"]["mode"],
): void {
  if (mode === plan.schema.mode) {
    return;
  }
  throw new CliError(
    "Invalid data stack Codex patch: /schema/mode cannot change schema mode because the stack plan does not store per-source schemas needed to prove replay compatibility.",
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

function assertHeaderlessColumnPatchWidth(
  plan: DataStackPlanArtifact,
  columns: readonly string[],
): void {
  if (columns.length === plan.input.columns.length) {
    return;
  }
  throw new CliError(
    `Invalid data stack Codex patch: /input/columns must preserve the headerless column count (${plan.input.columns.length}); received ${columns.length}.`,
    {
      code: "INVALID_INPUT",
      exitCode: 2,
    },
  );
}

function reconcileUniqueByForRenamedSchema(options: {
  nextNames: readonly string[];
  previousNames: readonly string[];
  uniqueBy: readonly string[];
}): string[] {
  const nextNames = [...options.nextNames];
  const nextNameSet = new Set(nextNames);
  const remappedUniqueBy = options.uniqueBy.map((name) => {
    const previousIndex = options.previousNames.indexOf(name);
    return previousIndex >= 0 ? (nextNames[previousIndex] ?? name) : name;
  });
  const unknownNames = remappedUniqueBy.filter((name) => !nextNameSet.has(name));
  if (unknownNames.length > 0) {
    throw new CliError(
      `Invalid data stack Codex patch: /input/columns leaves duplicates.uniqueBy with unknown schema names: ${unknownNames.join(", ")}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  return remappedUniqueBy;
}

function deriveHeaderlessColumnPatchState(
  plan: DataStackPlanArtifact,
  columns: readonly string[],
): Pick<DataStackPlanArtifact, "duplicates" | "input" | "schema"> {
  return {
    duplicates: {
      ...plan.duplicates,
      uniqueBy: reconcileUniqueByForRenamedSchema({
        nextNames: columns,
        previousNames: plan.schema.includedNames,
        uniqueBy: plan.duplicates.uniqueBy,
      }),
    },
    input: {
      ...plan.input,
      columns: [...columns],
    },
    schema: {
      ...plan.schema,
      includedNames: [...columns],
    },
  };
}

function deriveExcludedSchemaPatchState(
  plan: DataStackPlanArtifact,
  excludedNames: readonly string[],
): Pick<DataStackPlanArtifact, "duplicates" | "schema"> {
  const excludedNameSet = new Set(excludedNames);
  const fullSchemaBasis = [
    ...plan.schema.includedNames,
    ...plan.schema.excludedNames.filter((name) => !plan.schema.includedNames.includes(name)),
  ];
  return {
    duplicates: {
      ...plan.duplicates,
      uniqueBy: plan.duplicates.uniqueBy.filter((name) => !excludedNameSet.has(name)),
    },
    schema: {
      ...plan.schema,
      excludedNames: [...excludedNames],
      includedNames: fullSchemaBasis.filter((name) => !excludedNameSet.has(name)),
    },
  };
}

export function applyPatchToPlan(
  plan: DataStackPlanArtifact,
  patch: DataStackCodexPatch,
): DataStackPlanArtifact {
  const next = structuredClone(plan) as DataStackPlanArtifact;
  switch (patch.path) {
    case "/input/columns": {
      const state = deriveHeaderlessColumnPatchState(plan, patch.value as string[]);
      next.input = state.input;
      next.schema = state.schema;
      next.duplicates = state.duplicates;
      break;
    }
    case "/schema/mode":
      next.schema.mode = patch.value as DataStackPlanArtifact["schema"]["mode"];
      break;
    case "/schema/excludedNames":
      {
        const state = deriveExcludedSchemaPatchState(plan, patch.value as string[]);
        next.schema = state.schema;
        next.duplicates = state.duplicates;
      }
      break;
    case "/duplicates/uniqueBy":
      next.duplicates.uniqueBy = [...(patch.value as string[])];
      break;
    case "/duplicates/policy":
      next.duplicates.policy = patch.value as DataStackDuplicatePolicy;
      break;
  }
  return parseDataStackPlanArtifact(next);
}

export function validateDataStackCodexPatch(
  plan: DataStackPlanArtifact,
  patch: DataStackCodexPatch,
): DataStackCodexPatch {
  if (patch.op !== "replace") {
    throw new CliError("Invalid data stack Codex patch: only replace operations are supported.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const path = ensurePatchPath(patch.path);
  if (path === "/input/columns") {
    const columns = ensureStringArray(patch.value, path);
    if (plan.input.headerMode !== "no-header") {
      throw new CliError(
        "Invalid data stack Codex patch: /input/columns is only valid for headerless input.",
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    assertHeaderlessColumnPatchWidth(plan, columns);
    return { op: "replace", path, value: columns };
  }
  if (path === "/schema/mode") {
    const mode = ensureSchemaMode(patch.value);
    assertReplayableSchemaModePatch(plan, mode);
    assertExecutableSchemaPatch(plan, {
      ...plan.schema,
      mode,
    });
    return { op: "replace", path, value: mode };
  }
  if (path === "/schema/excludedNames") {
    const excludedNames = ensureStringArray(patch.value, path, { allowEmpty: true });
    assertKnownSchemaOrExcludedNames(plan, excludedNames, path);
    assertPreservesExistingExcludedNames(plan, excludedNames);
    assertExecutableSchemaPatch(plan, {
      ...plan.schema,
      excludedNames,
    });
    return {
      op: "replace",
      path,
      value: excludedNames,
    };
  }
  if (path === "/duplicates/uniqueBy") {
    const uniqueBy = ensureStringArray(patch.value, path, { allowEmpty: true });
    assertKnownSchemaNames(plan, uniqueBy, path);
    return { op: "replace", path, value: uniqueBy };
  }
  return { op: "replace", path, value: ensureDuplicatePolicy(patch.value) };
}

export function validateDataStackCodexRecommendation(
  plan: DataStackPlanArtifact,
  recommendation: DataStackCodexRecommendation,
): DataStackCodexRecommendation {
  const id = ensureString(recommendation.id, "recommendations[].id");
  const title = ensureString(recommendation.title, `recommendations[${id}].title`);
  const reasoningSummary = ensureString(
    recommendation.reasoningSummary,
    `recommendations[${id}].reasoningSummary`,
  );
  const confidence =
    typeof recommendation.confidence === "number" && Number.isFinite(recommendation.confidence)
      ? Math.max(0, Math.min(1, recommendation.confidence))
      : 0.5;
  if (!Array.isArray(recommendation.patches) || recommendation.patches.length === 0) {
    throw new CliError(`Invalid data stack Codex recommendation ${id}: patches cannot be empty.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  const seenPaths = new Set<string>();
  let validationPlan = plan;
  const patches = recommendation.patches.map((patch) => {
    const validated = validateDataStackCodexPatch(validationPlan, patch);
    if (seenPaths.has(validated.path)) {
      throw new CliError(
        `Invalid data stack Codex recommendation ${id}: duplicate patch path ${validated.path}.`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    seenPaths.add(validated.path);
    validationPlan = applyPatchToPlan(validationPlan, validated);
    return validated;
  });
  return {
    confidence,
    id,
    patches,
    reasoningSummary,
    title,
  };
}

export function validateDataStackCodexRecommendations(
  plan: DataStackPlanArtifact,
  recommendations: readonly DataStackCodexRecommendation[],
): DataStackCodexRecommendation[] {
  const seenIds = new Set<string>();
  return recommendations.map((recommendation) => {
    const validated = validateDataStackCodexRecommendation(plan, recommendation);
    if (seenIds.has(validated.id)) {
      throw new CliError(
        `Invalid data stack Codex report: duplicate recommendation id ${validated.id}.`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    seenIds.add(validated.id);
    return validated;
  });
}
