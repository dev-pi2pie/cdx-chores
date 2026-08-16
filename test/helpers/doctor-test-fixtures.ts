import type { CodexEnvironmentInspection } from "../../src/adapters/codex/shared";
import type { CommandStatus, DependencyCommand } from "../../src/cli/deps";
import type { DoctorInspectorOverrides, DoctorQueryInspection } from "../../src/cli/doctor/inspect";
import type { DoctorJsonPayload } from "../../src/cli/doctor/json";
import {
  assessMarkdownPdfRendererCapabilities,
  assessMarkdownPdfRequirements,
} from "../../src/cli/markdown-pdf";

export const DOCTOR_FIXTURE_COMMANDS: Record<DependencyCommand, CommandStatus> = {
  pandoc: {
    name: "pandoc",
    available: true,
    version: "3.1",
    installHint: "brew install pandoc",
  },
  ffmpeg: {
    name: "ffmpeg",
    available: true,
    version: "8.0.1",
    installHint: "brew install ffmpeg",
  },
  weasyprint: {
    name: "weasyprint",
    available: true,
    version: "68.0",
    installHint: "brew install weasyprint",
  },
  "fc-list": {
    name: "fc-list",
    available: true,
    version: "2.15.0",
    installHint: "brew install fontconfig",
  },
  "fc-query": {
    name: "fc-query",
    available: true,
    version: "2.15.0",
    installHint: "brew install fontconfig",
  },
};

export const DOCTOR_FIXTURE_QUERY: DoctorQueryInspection = {
  available: true,
  runtimeVersion: "1.5.0",
  sqlite: {
    installed: true,
    installable: true,
    loadable: true,
    loaded: true,
  },
  excel: {
    installed: true,
    installable: true,
    loadable: true,
    loaded: true,
  },
};

export const DOCTOR_FIXTURE_CODEX: CodexEnvironmentInspection = {
  configuredSupport: true,
  authSessionAvailable: true,
};

export interface DoctorFixtureCalls {
  codex: number;
  commands: string[];
  query: number;
}

export function createDoctorFixture(
  options: {
    codex?: CodexEnvironmentInspection;
    commands?: Partial<Record<DependencyCommand, CommandStatus>>;
    query?: DoctorQueryInspection;
  } = {},
): {
  calls: DoctorFixtureCalls;
  codex: CodexEnvironmentInspection;
  commands: Record<DependencyCommand, CommandStatus>;
  inspectors: DoctorInspectorOverrides;
  query: DoctorQueryInspection;
} {
  const calls: DoctorFixtureCalls = { codex: 0, commands: [], query: 0 };
  const commands = { ...DOCTOR_FIXTURE_COMMANDS, ...options.commands };
  const query = options.query ?? DOCTOR_FIXTURE_QUERY;
  const codex = options.codex ?? DOCTOR_FIXTURE_CODEX;

  return {
    calls,
    codex,
    commands,
    query,
    inspectors: {
      inspectCommand: async (command) => {
        calls.commands.push(command);
        return commands[command];
      },
      inspectDataQueryExtensions: async () => {
        calls.query += 1;
        return query;
      },
      inspectCodexEnvironment: async () => {
        calls.codex += 1;
        return codex;
      },
    },
  };
}

export function createExpectedDoctorJsonPayload(
  fixture: ReturnType<typeof createDoctorFixture>,
  generatedAt = "2026-08-16T00:00:00.000Z",
): DoctorJsonPayload {
  const queryFormats = {
    csv: { kind: "core" as const, detectedSupport: fixture.query.available },
    tsv: { kind: "core" as const, detectedSupport: fixture.query.available },
    parquet: { kind: "core" as const, detectedSupport: fixture.query.available },
    duckdb: { kind: "core" as const, detectedSupport: fixture.query.available },
    sqlite: {
      kind: "extension" as const,
      detectedSupport: fixture.query.available,
      loadability: fixture.query.sqlite?.loadable ?? false,
      installability: fixture.query.sqlite?.installable ?? null,
      detail: fixture.query.sqlite?.detail,
    },
    excel: {
      kind: "extension" as const,
      detectedSupport: fixture.query.available,
      loadability: fixture.query.excel?.loadable ?? false,
      installability: fixture.query.excel?.installable ?? null,
      detail: fixture.query.excel?.detail,
    },
  };
  const markdownPdfRequirements = assessMarkdownPdfRequirements(
    fixture.commands.pandoc,
    fixture.commands.weasyprint,
  );
  const markdownPdf = {
    ...markdownPdfRequirements,
    rendererCapabilities: assessMarkdownPdfRendererCapabilities({
      renderer: fixture.commands.weasyprint,
    }),
  };
  const queryCodex = {
    configuredSupport: fixture.codex.configuredSupport,
    authSessionAvailable: fixture.codex.authSessionAvailable,
    readyToDraft:
      fixture.codex.configuredSupport &&
      fixture.codex.authSessionAvailable &&
      fixture.query.available,
    detail: fixture.codex.detail ?? (fixture.query.available ? undefined : fixture.query.detail),
  };

  return {
    generatedAt,
    platform: "darwin",
    nodeVersion: process.version,
    tools: {
      pandoc: fixture.commands.pandoc,
      ffmpeg: fixture.commands.ffmpeg,
      weasyprint: fixture.commands.weasyprint,
    },
    markdownPdf,
    query: {
      available: fixture.query.available,
      detail: fixture.query.detail,
      formats: queryFormats,
      runtimeVersion: fixture.query.runtimeVersion,
    },
    queryCodex,
    font: {
      discovery: {
        fontconfig: {
          command: "fc-list",
          available: fixture.commands["fc-list"].available,
          version: fixture.commands["fc-list"].version,
        },
      },
      coverage: {
        fontconfig: {
          command: "fc-query",
          available: fixture.commands["fc-query"].available,
          version: fixture.commands["fc-query"].version,
        },
      },
    },
    capabilities: {
      "md.to-docx": fixture.commands.pandoc.available,
      "md.to-pdf": markdownPdf.ready,
      "video.convert": fixture.commands.ffmpeg.available,
      "video.resize": fixture.commands.ffmpeg.available,
      "video.gif": fixture.commands.ffmpeg.available,
      "data.query.csv": queryFormats.csv.detectedSupport,
      "data.query.tsv": queryFormats.tsv.detectedSupport,
      "data.query.parquet": queryFormats.parquet.detectedSupport,
      "data.query.duckdb": queryFormats.duckdb.detectedSupport,
      "data.query.sqlite": queryFormats.sqlite.loadability,
      "data.query.excel": queryFormats.excel.loadability,
      "data.query.codex": queryCodex.readyToDraft,
      "font.discovery.fontconfig": fixture.commands["fc-list"].available,
      "font.coverage.fontconfig": fixture.commands["fc-query"].available,
    },
  };
}

export function createExpectedAllReadyDoctorHumanOutput(
  fixture: ReturnType<typeof createDoctorFixture>,
): string {
  const payload = createExpectedDoctorJsonPayload(fixture);
  const lines = [
    "cdx-chores doctor",
    `Platform: ${payload.platform}`,
    `Node.js: ${payload.nodeVersion}`,
    "",
    `- pandoc: available (${payload.tools.pandoc.version})`,
    `- ffmpeg: available (${payload.tools.ffmpeg.version})`,
    `- weasyprint: available (${payload.tools.weasyprint.version})`,
    "",
    "Capabilities:",
    ...Object.entries(payload.capabilities).map(
      ([capability, available]) => `- ${capability}: ${available ? "available" : "unavailable"}`,
    ),
    "",
    "Markdown PDF renderer capabilities:",
    `- weasyprint: installed (${payload.markdownPdf.rendererCapabilities.renderer.version})`,
    ...payload.markdownPdf.rendererCapabilities.capabilities.map(
      (capability) =>
        `- ${capability.id}: ${capability.status}, minimum=${capability.minimumVersion}${capability.diagnosticConditionId ? `, diagnostic=${capability.diagnosticConditionId}` : ""}`,
    ),
    "",
    "Font support:",
    `- fontconfig discovery: available (${payload.font.discovery.fontconfig.version})`,
    `- fontconfig coverage: available (${payload.font.coverage.fontconfig.version})`,
    "",
    "Data query formats:",
    `DuckDB runtime: ${payload.query.runtimeVersion}`,
    "- csv: built-in DuckDB support=yes",
    "- tsv: built-in DuckDB support=yes",
    "- parquet: built-in DuckDB support=yes",
    "- duckdb: built-in DuckDB support=yes",
    "- sqlite: detected support=yes, loadability=yes, installability=yes",
    "- excel: detected support=yes, loadability=yes, installability=yes",
    "",
    "Data query Codex:",
    "- codex: configured support=yes, auth/session=yes, ready-to-draft=yes",
  ];
  return `${lines.join("\n")}\n`;
}
