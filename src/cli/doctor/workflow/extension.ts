import { createDuckDbExtensionInstallCommand } from "../../duckdb/extensions";
import type { DoctorExtensionQueryFormat } from "../report";
import { addAction, addCondition, type MutableProjection } from "./kernel";
import type { DoctorActionId, DoctorConditionId } from "./model";

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

export function projectExtension(
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
