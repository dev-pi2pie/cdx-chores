import {
  DOCTOR_WORKFLOWS,
  type DoctorAction,
  type DoctorActionClass,
  type DoctorActionId,
  type DoctorCondition,
  type DoctorConditionId,
  type DoctorWorkflowId,
  type DoctorWorkflowProjection,
  type DoctorWorkflowState,
} from "./model";

const WORKFLOW_ORDER = new Map(
  DOCTOR_WORKFLOWS.map((workflow, index) => [workflow.id, index] as const),
);
const STATE_PRIORITY: Record<DoctorWorkflowState, number> = {
  ready: 0,
  limited: 1,
  unknown: 2,
  unavailable: 3,
};
const ACTION_CLASS_ORDER: Record<DoctorActionClass, number> = {
  required: 0,
  recommended: 1,
};

export interface MutableProjection {
  actions: Map<DoctorActionId, DoctorAction>;
  conditions: Map<DoctorConditionId, DoctorCondition>;
  states: Map<DoctorWorkflowId, DoctorWorkflowState>;
}

function workflowOrder(id: DoctorWorkflowId): number {
  return WORKFLOW_ORDER.get(id) ?? Number.MAX_SAFE_INTEGER;
}

function firstWorkflowOrder(ids: readonly DoctorWorkflowId[]): number {
  return ids.reduce((minimum, id) => Math.min(minimum, workflowOrder(id)), Number.MAX_SAFE_INTEGER);
}

function mergeWorkflowIds(
  current: readonly DoctorWorkflowId[],
  added: readonly DoctorWorkflowId[],
): DoctorWorkflowId[] {
  return [...new Set([...current, ...added])].sort((left, right) => {
    return workflowOrder(left) - workflowOrder(right);
  });
}

function setState(
  projection: MutableProjection,
  workflowId: DoctorWorkflowId,
  state: DoctorWorkflowState,
): void {
  const current = projection.states.get(workflowId) ?? "ready";
  if (STATE_PRIORITY[state] > STATE_PRIORITY[current]) {
    projection.states.set(workflowId, state);
  }
}

export function addCondition(
  projection: MutableProjection,
  condition: DoctorCondition,
  state: DoctorWorkflowState,
): void {
  const current = projection.conditions.get(condition.id);
  projection.conditions.set(condition.id, {
    ...condition,
    affectedWorkflowIds: mergeWorkflowIds(
      current?.affectedWorkflowIds ?? [],
      condition.affectedWorkflowIds,
    ),
  });
  for (const workflowId of condition.affectedWorkflowIds) {
    setState(projection, workflowId, state);
  }
}

export function addAction(projection: MutableProjection, action: DoctorAction): void {
  const current = projection.actions.get(action.id);
  projection.actions.set(action.id, {
    ...(current ?? action),
    affectedWorkflowIds: mergeWorkflowIds(
      current?.affectedWorkflowIds ?? [],
      action.affectedWorkflowIds,
    ),
  });
}

function sortedConditions(projection: MutableProjection): DoctorCondition[] {
  return [...projection.conditions.values()].sort((left, right) => {
    return (
      firstWorkflowOrder(left.affectedWorkflowIds) -
        firstWorkflowOrder(right.affectedWorkflowIds) || left.id.localeCompare(right.id)
    );
  });
}

function sortedActions(projection: MutableProjection): DoctorAction[] {
  return [...projection.actions.values()].sort((left, right) => {
    return (
      ACTION_CLASS_ORDER[left.class] - ACTION_CLASS_ORDER[right.class] ||
      firstWorkflowOrder(left.affectedWorkflowIds) -
        firstWorkflowOrder(right.affectedWorkflowIds) ||
      left.id.localeCompare(right.id)
    );
  });
}

export function createMutableProjection(): MutableProjection {
  return {
    actions: new Map(),
    conditions: new Map(),
    states: new Map(DOCTOR_WORKFLOWS.map((workflow) => [workflow.id, "ready"] as const)),
  };
}

export function finalizeProjection(projection: MutableProjection): DoctorWorkflowProjection {
  const conditions = sortedConditions(projection);
  const actions = sortedActions(projection);
  const workflows = DOCTOR_WORKFLOWS.map((definition) => ({
    ...definition,
    state: projection.states.get(definition.id) ?? "ready",
    conditionIds: conditions
      .filter((condition) => condition.affectedWorkflowIds.includes(definition.id))
      .map((condition) => condition.id),
  }));

  return {
    workflows,
    conditions,
    actions,
    issueCount: conditions.length,
    actionCount: actions.length,
  };
}
