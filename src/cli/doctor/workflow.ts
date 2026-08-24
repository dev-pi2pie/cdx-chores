import type { DoctorReport } from "./report";
import { projectDataQuery } from "./workflow/data";
import { projectFonts } from "./workflow/fonts";
import { createMutableProjection, finalizeProjection } from "./workflow/kernel";
import { projectMarkdown } from "./workflow/markdown";
import type { DoctorWorkflowProjection } from "./workflow/model";
import { projectVideo } from "./workflow/video";

export { DOCTOR_ACTION_IDS, DOCTOR_CONDITION_IDS, DOCTOR_WORKFLOWS } from "./workflow/model";
export type {
  DoctorAction,
  DoctorActionClass,
  DoctorActionId,
  DoctorCondition,
  DoctorConditionId,
  DoctorWorkflow,
  DoctorWorkflowId,
  DoctorWorkflowProjection,
  DoctorWorkflowState,
} from "./workflow/model";

export function projectDoctorWorkflows(report: DoctorReport): DoctorWorkflowProjection {
  const projection = createMutableProjection();

  projectMarkdown(projection, report);
  projectVideo(projection, report);
  projectDataQuery(projection, report);
  projectFonts(projection, report);

  return finalizeProjection(projection);
}
