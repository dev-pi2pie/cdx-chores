import type { CodexEnvironmentInspection } from "../../src/adapters/codex/shared";
import type { CommandStatus, DependencyCommand } from "../../src/cli/deps";
import type { DoctorInspectorOverrides, DoctorQueryInspection } from "../../src/cli/doctor/inspect";

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
