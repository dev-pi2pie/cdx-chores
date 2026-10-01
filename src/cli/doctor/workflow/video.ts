import type { DoctorReport } from "../report";
import { addAction, addCondition, type MutableProjection } from "./kernel";

export function projectVideo(projection: MutableProjection, report: DoctorReport): void {
  const { ffmpeg, ffprobe } = report.tools;
  if (!ffmpeg.available) {
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
      command: ffmpeg.installHint,
      affectedWorkflowIds: ["video"],
    });
  }
  if (!ffprobe.available) {
    addCondition(
      projection,
      {
        id: "dependency.ffprobe.missing",
        message: "FFprobe is required for video frames",
        affectedWorkflowIds: ["video"],
      },
      "limited",
    );
    addAction(projection, {
      id: "dependency.ffprobe.install",
      class: "required",
      message: "Check FFprobe installation and PATH for video frames",
      command: ffprobe.installHint,
      affectedWorkflowIds: ["video"],
    });
  }
  if (!ffmpeg.available || !ffprobe.available) return;

  const encoders = report.videoFrames.encoders;
  const assessments = [
    ["PNG", encoders.png],
    ["JPG", encoders.jpg],
    ["still WebP", encoders.webp],
    ["WebP full (lossless)", encoders.webpLossless],
  ] as const;
  const unsupported = assessments
    .filter(([, status]) => status === "unsupported")
    .map(([name]) => name);
  const unknown = assessments.filter(([, status]) => status === "unknown").map(([name]) => name);
  if (unsupported.length) {
    addCondition(
      projection,
      {
        id: "video.frames.encoder.unsupported",
        message: `Video frames encoder support is unavailable: ${unsupported.join(", ")}`,
        affectedWorkflowIds: ["video"],
      },
      "limited",
    );
    addAction(projection, {
      id: "video.frames.encoder.install",
      class: "required",
      message: "Use an encoder-enabled FFmpeg build for the affected video frames formats/modes",
      affectedWorkflowIds: ["video"],
    });
  }
  if (unknown.length) {
    addCondition(
      projection,
      {
        id: "video.frames.encoder.unknown",
        message: `Video frames encoder support could not be verified: ${unknown.join(", ")}`,
        affectedWorkflowIds: ["video"],
      },
      unsupported.length ? "limited" : "unknown",
    );
    addAction(projection, {
      id: "video.frames.encoder.verify",
      class: "recommended",
      message: "Verify the intended FFmpeg encoder capabilities and PATH for video frames",
      affectedWorkflowIds: ["video"],
    });
  }
}
