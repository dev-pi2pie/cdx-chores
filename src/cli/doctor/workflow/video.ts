import type { DoctorReport } from "../report";
import { addAction, addCondition, type MutableProjection } from "./kernel";

export function projectVideo(projection: MutableProjection, report: DoctorReport): void {
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
