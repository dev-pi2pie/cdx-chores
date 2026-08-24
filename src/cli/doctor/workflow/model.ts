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
