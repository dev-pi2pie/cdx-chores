import type { CommandStatus } from "../deps";
import {
  assessMarkdownPdfRendererCapabilities,
  type MarkdownPdfRendererCapabilityAssessment,
} from "../markdown-pdf/renderer-capabilities";
import {
  assessMarkdownPdfRequirements,
  type MarkdownPdfRequirements,
} from "../markdown-pdf/requirements";
import type { DoctorInspection } from "./inspect";

export const DOCTOR_CAPABILITY_IDS = [
  "md.to-docx",
  "md.to-pdf",
  "video.convert",
  "video.resize",
  "video.gif",
  "data.query.csv",
  "data.query.tsv",
  "data.query.parquet",
  "data.query.duckdb",
  "data.query.sqlite",
  "data.query.excel",
  "data.query.codex",
  "font.discovery.fontconfig",
  "font.coverage.fontconfig",
] as const;

export type DoctorCapabilityId = (typeof DOCTOR_CAPABILITY_IDS)[number];
export type DoctorCapabilities = Record<DoctorCapabilityId, boolean>;

export interface DoctorCoreQueryFormat {
  detectedSupport: boolean;
  kind: "core";
}

export interface DoctorExtensionQueryFormat {
  detectedSupport: boolean;
  detail?: string;
  installability: boolean | null;
  kind: "extension";
  loadability: boolean;
}

export interface DoctorQueryFormats {
  csv: DoctorCoreQueryFormat;
  tsv: DoctorCoreQueryFormat;
  parquet: DoctorCoreQueryFormat;
  duckdb: DoctorCoreQueryFormat;
  sqlite: DoctorExtensionQueryFormat;
  excel: DoctorExtensionQueryFormat;
}

export interface DoctorReport {
  capabilities: DoctorCapabilities;
  font: {
    discovery: {
      fontconfig: {
        command: "fc-list";
        available: boolean;
        version: string | null;
      };
    };
    coverage: {
      fontconfig: {
        command: "fc-query";
        available: boolean;
        version: string | null;
      };
    };
  };
  markdownPdf: MarkdownPdfRequirements & {
    rendererCapabilities: MarkdownPdfRendererCapabilityAssessment;
  };
  nodeVersion: string;
  platform: NodeJS.Platform;
  query: {
    available: boolean;
    detail?: string;
    formats: DoctorQueryFormats;
    runtimeVersion?: string;
  };
  queryCodex: {
    authSessionAvailable: boolean;
    configuredSupport: boolean;
    detail?: string;
    readyToDraft: boolean;
  };
  remediation: {
    fontconfigInstallHint: string;
  };
  tools: {
    pandoc: CommandStatus;
    ffmpeg: CommandStatus;
    weasyprint: CommandStatus;
  };
}

export function buildDoctorReport(
  runtimeFacts: { nodeVersion: string; platform: NodeJS.Platform },
  inspection: DoctorInspection,
): DoctorReport {
  const { codexEnvironment, queryExtensions } = inspection;
  const queryFormats: DoctorQueryFormats = {
    csv: {
      kind: "core",
      detectedSupport: queryExtensions.available,
    },
    tsv: {
      kind: "core",
      detectedSupport: queryExtensions.available,
    },
    parquet: {
      kind: "core",
      detectedSupport: queryExtensions.available,
    },
    duckdb: {
      kind: "core",
      detectedSupport: queryExtensions.available,
    },
    sqlite: {
      kind: "extension",
      detectedSupport: queryExtensions.available,
      loadability: queryExtensions.sqlite?.loadable ?? false,
      installability: queryExtensions.sqlite?.installable ?? null,
      detail: queryExtensions.sqlite?.detail,
    },
    excel: {
      kind: "extension",
      detectedSupport: queryExtensions.available,
      loadability: queryExtensions.excel?.loadable ?? false,
      installability: queryExtensions.excel?.installable ?? null,
      detail: queryExtensions.excel?.detail,
    },
  };

  const queryCodex = {
    configuredSupport: codexEnvironment.configuredSupport,
    authSessionAvailable: codexEnvironment.authSessionAvailable,
    readyToDraft:
      codexEnvironment.configuredSupport &&
      codexEnvironment.authSessionAvailable &&
      queryExtensions.available,
    detail:
      codexEnvironment.detail ?? (queryExtensions.available ? undefined : queryExtensions.detail),
  };

  const markdownPdfRequirements = assessMarkdownPdfRequirements(
    inspection.pandoc,
    inspection.weasyprint,
  );
  const markdownPdf = {
    ...markdownPdfRequirements,
    rendererCapabilities: assessMarkdownPdfRendererCapabilities({
      renderer: inspection.weasyprint,
    }),
  };

  const capabilities: DoctorCapabilities = {
    "md.to-docx": inspection.pandoc.available,
    "md.to-pdf": markdownPdf.ready,
    "video.convert": inspection.ffmpeg.available,
    "video.resize": inspection.ffmpeg.available,
    "video.gif": inspection.ffmpeg.available,
    "data.query.csv": queryFormats.csv.detectedSupport,
    "data.query.tsv": queryFormats.tsv.detectedSupport,
    "data.query.parquet": queryFormats.parquet.detectedSupport,
    "data.query.duckdb": queryFormats.duckdb.detectedSupport,
    "data.query.sqlite": queryFormats.sqlite.loadability,
    "data.query.excel": queryFormats.excel.loadability,
    "data.query.codex": queryCodex.readyToDraft,
    "font.discovery.fontconfig": inspection.fontconfigDiscovery.available,
    "font.coverage.fontconfig": inspection.fontconfigCoverage.available,
  };

  return {
    platform: runtimeFacts.platform,
    nodeVersion: runtimeFacts.nodeVersion,
    tools: {
      pandoc: inspection.pandoc,
      ffmpeg: inspection.ffmpeg,
      weasyprint: inspection.weasyprint,
    },
    markdownPdf,
    query: {
      available: queryExtensions.available,
      detail: queryExtensions.detail,
      formats: queryFormats,
      runtimeVersion: queryExtensions.runtimeVersion,
    },
    queryCodex,
    remediation: {
      fontconfigInstallHint: inspection.fontconfigDiscovery.installHint,
    },
    font: {
      discovery: {
        fontconfig: {
          command: "fc-list",
          available: inspection.fontconfigDiscovery.available,
          version: inspection.fontconfigDiscovery.version,
        },
      },
      coverage: {
        fontconfig: {
          command: "fc-query",
          available: inspection.fontconfigCoverage.available,
          version: inspection.fontconfigCoverage.version,
        },
      },
    },
    capabilities,
  };
}
