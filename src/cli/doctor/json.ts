import type { DoctorReport } from "./report";

type DoctorJsonFields = Pick<
  DoctorReport,
  | "platform"
  | "nodeVersion"
  | "tools"
  | "markdownPdf"
  | "query"
  | "queryCodex"
  | "font"
  | "capabilities"
  | "videoFrames"
  | "codexBenchmark"
>;

export type DoctorJsonPayload = DoctorJsonFields & {
  generatedAt: string;
};

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
    codexBenchmark: report.codexBenchmark,
    font: report.font,
    capabilities: report.capabilities,
    videoFrames: report.videoFrames,
  };
}

export function serializeDoctorJson(report: DoctorReport, generatedAt: string): string {
  return JSON.stringify(createDoctorJsonPayload(report, generatedAt), null, 2);
}
