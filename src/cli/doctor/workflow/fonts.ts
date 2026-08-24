import type { DoctorReport } from "../report";
import { addAction, addCondition, type MutableProjection } from "./kernel";

export function projectFonts(projection: MutableProjection, report: DoctorReport): void {
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
