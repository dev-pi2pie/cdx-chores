import type { DependencyCommandRunner } from "../deps";
import { inspectDoctor, type DoctorInspectorOverrides } from "../doctor/inspect";
import { serializeDoctorJson } from "../doctor/json";
import { renderCompactDoctorReport, renderDetailedDoctorReport } from "../doctor/render";
import { buildDoctorReport } from "../doctor/report";
import { projectDoctorWorkflows } from "../doctor/workflow";
import type { CliRuntime } from "../types";
import { printLine } from "./shared";

export interface DoctorOptions {
  dependencyRunner?: DependencyCommandRunner;
  details?: boolean;
  inspectors?: DoctorInspectorOverrides;
  json?: boolean;
}

export async function actionDoctor(
  runtime: CliRuntime,
  options: DoctorOptions = {},
): Promise<void> {
  const inspection = await inspectDoctor(runtime, options);
  const report = buildDoctorReport(
    { platform: runtime.platform, nodeVersion: process.version },
    inspection,
  );

  if (options.json) {
    printLine(runtime.stdout, serializeDoctorJson(report, runtime.now().toISOString()));
    return;
  }

  if (options.details) {
    renderDetailedDoctorReport(runtime, report);
    return;
  }

  renderCompactDoctorReport(runtime, projectDoctorWorkflows(report));
}
