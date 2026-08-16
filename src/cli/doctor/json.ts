import type { DoctorReport } from "./report";

export interface DoctorJsonPayload extends DoctorReport {
  generatedAt: string;
}

export function createDoctorJsonPayload(
  report: DoctorReport,
  generatedAt: string,
): DoctorJsonPayload {
  return {
    generatedAt,
    platform: report.platform,
    nodeVersion: report.nodeVersion,
    tools: report.tools,
    markdownPdf: report.markdownPdf,
    query: report.query,
    queryCodex: report.queryCodex,
    font: report.font,
    capabilities: report.capabilities,
  };
}

export function serializeDoctorJson(report: DoctorReport, generatedAt: string): string {
  return JSON.stringify(createDoctorJsonPayload(report, generatedAt), null, 2);
}
