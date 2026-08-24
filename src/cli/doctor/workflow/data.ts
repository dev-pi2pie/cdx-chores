import type { DoctorReport } from "../report";
import { projectExtension } from "./extension";
import { addAction, addCondition, type MutableProjection } from "./kernel";

export function projectDataQuery(projection: MutableProjection, report: DoctorReport): void {
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
