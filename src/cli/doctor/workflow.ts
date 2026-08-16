import { createDuckDbExtensionInstallCommand } from "../duckdb/extensions";
import type { DoctorExtensionQueryFormat, DoctorReport } from "./report";

export const DOCTOR_WORKFLOWS = [
  { id: "markdown.docx", label: "Markdown DOCX" },
  { id: "markdown.pdf", label: "Markdown PDF" },
  { id: "video", label: "Video" },
  { id: "data.query", label: "Data query" },
  { id: "data.query.codex", label: "Codex-assisted data query" },
  { id: "font.discovery", label: "Font discovery" },
  { id: "font.coverage", label: "Font coverage" },
] as const;

export const DOCTOR_CONDITION_IDS = [
  "dependency.pandoc.missing",
  "dependency.pandoc.unsupported",
  "dependency.pandoc.unverified",
  "dependency.weasyprint.missing",
  "dependency.ffmpeg.missing",
  "dependency.fontconfig.discovery.missing",
  "dependency.fontconfig.coverage.missing",
  "markdown.pdf.renderer.capability.unsupported",
  "markdown.pdf.renderer.capability.unverified",
  "data.query.runtime.unavailable",
  "data.query.extension.sqlite.unavailable",
  "data.query.extension.excel.unavailable",
  "data.query.codex.unconfigured",
  "data.query.codex.unauthenticated",
] as const;

export const DOCTOR_ACTION_IDS = [
  "dependency.pandoc.install",
  "dependency.pandoc.upgrade",
  "dependency.pandoc.verify",
  "dependency.weasyprint.install",
  "dependency.weasyprint.upgrade",
  "dependency.weasyprint.verify",
  "dependency.ffmpeg.install",
  "dependency.fontconfig.install",
  "data.query.extension.sqlite.install",
  "data.query.extension.excel.install",
  "data.query.codex.configure",
  "data.query.codex.authenticate",
] as const;

export type DoctorWorkflowId = (typeof DOCTOR_WORKFLOWS)[number]["id"];
export type DoctorConditionId = (typeof DOCTOR_CONDITION_IDS)[number];
export type DoctorActionId = (typeof DOCTOR_ACTION_IDS)[number];
export type DoctorWorkflowState = "ready" | "limited" | "unavailable" | "unknown";
export type DoctorActionClass = "required" | "recommended";

export interface DoctorWorkflow {
  conditionIds: DoctorConditionId[];
  id: DoctorWorkflowId;
  label: string;
  state: DoctorWorkflowState;
}

export interface DoctorCondition {
  affectedWorkflowIds: DoctorWorkflowId[];
  id: DoctorConditionId;
  message: string;
}

export interface DoctorAction {
  affectedWorkflowIds: DoctorWorkflowId[];
  class: DoctorActionClass;
  command?: string;
  id: DoctorActionId;
  message: string;
}

export interface DoctorWorkflowProjection {
  actionCount: number;
  actions: DoctorAction[];
  conditions: DoctorCondition[];
  issueCount: number;
  workflows: DoctorWorkflow[];
}

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
const EXTENSION_PROJECTION = {
  sqlite: {
    actionId: "data.query.extension.sqlite.install",
    conditionId: "data.query.extension.sqlite.unavailable",
    label: "SQLite",
  },
  excel: {
    actionId: "data.query.extension.excel.install",
    conditionId: "data.query.extension.excel.unavailable",
    label: "Excel",
  },
} satisfies Record<
  "sqlite" | "excel",
  { actionId: DoctorActionId; conditionId: DoctorConditionId; label: string }
>;

interface MutableProjection {
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

function addCondition(
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

function addAction(projection: MutableProjection, action: DoctorAction): void {
  const current = projection.actions.get(action.id);
  projection.actions.set(action.id, {
    ...(current ?? action),
    affectedWorkflowIds: mergeWorkflowIds(
      current?.affectedWorkflowIds ?? [],
      action.affectedWorkflowIds,
    ),
  });
}

function addMissingPandoc(projection: MutableProjection, report: DoctorReport): void {
  const affectedWorkflowIds: DoctorWorkflowId[] = ["markdown.docx", "markdown.pdf"];
  addCondition(
    projection,
    {
      id: "dependency.pandoc.missing",
      message: "Pandoc is missing",
      affectedWorkflowIds,
    },
    "unavailable",
  );
  addAction(projection, {
    id: "dependency.pandoc.install",
    class: "required",
    message: "Install Pandoc",
    command: report.tools.pandoc.installHint,
    affectedWorkflowIds,
  });
}

function projectMarkdown(projection: MutableProjection, report: DoctorReport): void {
  const pandoc = report.markdownPdf.requirements.pandoc;
  if (pandoc.status === "missing") {
    addMissingPandoc(projection, report);
  } else if (pandoc.status === "unsupported") {
    addCondition(
      projection,
      {
        id: "dependency.pandoc.unsupported",
        message: "Pandoc does not meet the required 2.0 minimum",
        affectedWorkflowIds: ["markdown.pdf"],
      },
      "unavailable",
    );
    addAction(projection, {
      id: "dependency.pandoc.upgrade",
      class: "required",
      message: "Upgrade Pandoc to 2.0 or newer",
      affectedWorkflowIds: ["markdown.pdf"],
    });
  } else if (pandoc.status === "unverified") {
    addCondition(
      projection,
      {
        id: "dependency.pandoc.unverified",
        message: "Pandoc 2.0 or newer could not be verified",
        affectedWorkflowIds: ["markdown.pdf"],
      },
      "unknown",
    );
    addAction(projection, {
      id: "dependency.pandoc.verify",
      class: "recommended",
      message: "Verify Pandoc 2.0 or newer",
      affectedWorkflowIds: ["markdown.pdf"],
    });
  }

  if (report.markdownPdf.requirements.weasyprint.status === "missing") {
    addCondition(
      projection,
      {
        id: "dependency.weasyprint.missing",
        message: "WeasyPrint is missing",
        affectedWorkflowIds: ["markdown.pdf"],
      },
      "unavailable",
    );
    addAction(projection, {
      id: "dependency.weasyprint.install",
      class: "required",
      message: "Install WeasyPrint",
      command: report.tools.weasyprint.installHint,
      affectedWorkflowIds: ["markdown.pdf"],
    });
  }

  const baseRequirementsReady =
    pandoc.status === "satisfied" &&
    report.markdownPdf.requirements.weasyprint.status === "satisfied";
  if (!baseRequirementsReady) {
    return;
  }

  const rendererStatuses = new Set(
    report.markdownPdf.rendererCapabilities.capabilities.map((capability) => capability.status),
  );
  rendererStatuses.delete("satisfied");
  if (rendererStatuses.size === 0) {
    return;
  }

  const unsupported = rendererStatuses.has("unsupported") || rendererStatuses.has("missing");
  if (unsupported) {
    addCondition(
      projection,
      {
        id: "markdown.pdf.renderer.capability.unsupported",
        message: "Advanced Markdown PDF features require WeasyPrint 65.1 or newer",
        affectedWorkflowIds: ["markdown.pdf"],
      },
      "limited",
    );
    addAction(projection, {
      id: "dependency.weasyprint.upgrade",
      class: "recommended",
      message: "Upgrade WeasyPrint to 65.1 or newer",
      affectedWorkflowIds: ["markdown.pdf"],
    });
    return;
  }

  addCondition(
    projection,
    {
      id: "markdown.pdf.renderer.capability.unverified",
      message: "Advanced Markdown PDF compatibility could not be verified",
      affectedWorkflowIds: ["markdown.pdf"],
    },
    "limited",
  );
  addAction(projection, {
    id: "dependency.weasyprint.verify",
    class: "recommended",
    message: "Verify WeasyPrint 65.1 or newer",
    affectedWorkflowIds: ["markdown.pdf"],
  });
}

function projectVideo(projection: MutableProjection, report: DoctorReport): void {
  if (report.tools.ffmpeg.available) {
    return;
  }
  addCondition(
    projection,
    {
      id: "dependency.ffmpeg.missing",
      message: "FFmpeg is missing",
      affectedWorkflowIds: ["video"],
    },
    "unavailable",
  );
  addAction(projection, {
    id: "dependency.ffmpeg.install",
    class: "required",
    message: "Install FFmpeg",
    command: report.tools.ffmpeg.installHint,
    affectedWorkflowIds: ["video"],
  });
}

function projectExtension(
  projection: MutableProjection,
  name: "sqlite" | "excel",
  format: DoctorExtensionQueryFormat,
): void {
  if (format.loadability) {
    return;
  }
  const metadata = EXTENSION_PROJECTION[name];
  const message =
    format.installability === true
      ? `${metadata.label} query support is unavailable but installable`
      : format.installability === false
        ? `${metadata.label} query support is unavailable in this environment`
        : `${metadata.label} query support could not be verified`;
  addCondition(
    projection,
    { id: metadata.conditionId, message, affectedWorkflowIds: ["data.query"] },
    "limited",
  );
  if (format.installability === true) {
    addAction(projection, {
      id: metadata.actionId,
      class: "required",
      message: `Install the DuckDB ${metadata.label} extension`,
      command: createDuckDbExtensionInstallCommand(name),
      affectedWorkflowIds: ["data.query"],
    });
  }
}

function projectDataQuery(projection: MutableProjection, report: DoctorReport): void {
  if (!report.query.available) {
    addCondition(
      projection,
      {
        id: "data.query.runtime.unavailable",
        message: "DuckDB runtime is unavailable",
        affectedWorkflowIds: ["data.query", "data.query.codex"],
      },
      "unavailable",
    );
  } else {
    projectExtension(projection, "sqlite", report.query.formats.sqlite);
    projectExtension(projection, "excel", report.query.formats.excel);
  }

  if (!report.queryCodex.configuredSupport) {
    addCondition(
      projection,
      {
        id: "data.query.codex.unconfigured",
        message: "Codex support is not configured",
        affectedWorkflowIds: ["data.query.codex"],
      },
      "unavailable",
    );
    addAction(projection, {
      id: "data.query.codex.configure",
      class: "required",
      message: "Configure Codex support",
      affectedWorkflowIds: ["data.query.codex"],
    });
  } else if (!report.queryCodex.authSessionAvailable) {
    addCondition(
      projection,
      {
        id: "data.query.codex.unauthenticated",
        message: "No Codex authentication session is available",
        affectedWorkflowIds: ["data.query.codex"],
      },
      "unavailable",
    );
    addAction(projection, {
      id: "data.query.codex.authenticate",
      class: "required",
      message: "Sign in to Codex or provide CODEX_API_KEY",
      affectedWorkflowIds: ["data.query.codex"],
    });
  }
}

function projectFonts(projection: MutableProjection, report: DoctorReport): void {
  const fontconfig = [
    {
      available: report.font.discovery.fontconfig.available,
      command: report.font.discovery.fontconfig.command,
      conditionId: "dependency.fontconfig.discovery.missing" as const,
      installHint: report.remediation.fontconfigInstallHints.discovery,
      message: "Fontconfig discovery is unavailable",
      workflowId: "font.discovery" as const,
    },
    {
      available: report.font.coverage.fontconfig.available,
      command: report.font.coverage.fontconfig.command,
      conditionId: "dependency.fontconfig.coverage.missing" as const,
      installHint: report.remediation.fontconfigInstallHints.coverage,
      message: "Fontconfig coverage is unavailable",
      workflowId: "font.coverage" as const,
    },
  ];
  const missingProbes = fontconfig.filter((probe) => !probe.available);

  for (const probe of missingProbes) {
    addCondition(
      projection,
      {
        id: probe.conditionId,
        message: probe.message,
        affectedWorkflowIds: [probe.workflowId],
      },
      "unavailable",
    );
  }

  if (missingProbes.length === 0) {
    return;
  }

  const installHints = [...new Set(missingProbes.map((probe) => probe.installHint))];
  const missingCommands = missingProbes.map((probe) => probe.command).join(" and ");
  addAction(projection, {
    id: "dependency.fontconfig.install",
    class: "required",
    message: "Install Fontconfig",
    command:
      installHints.length === 1
        ? installHints[0]
        : `Install fontconfig and ensure ${missingCommands} are on PATH`,
    affectedWorkflowIds: missingProbes.map((probe) => probe.workflowId),
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

export function projectDoctorWorkflows(report: DoctorReport): DoctorWorkflowProjection {
  const projection: MutableProjection = {
    actions: new Map(),
    conditions: new Map(),
    states: new Map(DOCTOR_WORKFLOWS.map((workflow) => [workflow.id, "ready"] as const)),
  };

  projectMarkdown(projection, report);
  projectVideo(projection, report);
  projectDataQuery(projection, report);
  projectFonts(projection, report);

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
