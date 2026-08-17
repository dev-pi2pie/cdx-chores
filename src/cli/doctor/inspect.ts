import {
  inspectCodexEnvironment,
  type CodexEnvironmentInspection,
} from "../../adapters/codex/shared";
import { inspectCommand, type CommandStatus, type DependencyCommandRunner } from "../deps";
import { inspectDataQueryExtensions } from "../duckdb/query";
import type { CliRuntime } from "../types";

export type DoctorQueryInspection = Awaited<ReturnType<typeof inspectDataQueryExtensions>>;

export interface DoctorInspectors {
  inspectCodexEnvironment: () => Promise<CodexEnvironmentInspection>;
  inspectCommand: typeof inspectCommand;
  inspectDataQueryExtensions: () => Promise<DoctorQueryInspection>;
}

export type DoctorInspectorOverrides = Partial<DoctorInspectors>;

export interface DoctorInspection {
  codexEnvironment: CodexEnvironmentInspection;
  ffmpeg: CommandStatus;
  fontconfigCoverage: CommandStatus;
  fontconfigDiscovery: CommandStatus;
  pandoc: CommandStatus;
  queryExtensions: DoctorQueryInspection;
  weasyprint: CommandStatus;
}

const DEFAULT_DOCTOR_INSPECTORS: DoctorInspectors = {
  inspectCodexEnvironment,
  inspectCommand,
  inspectDataQueryExtensions,
};

export async function inspectDoctor(
  runtime: CliRuntime,
  options: {
    dependencyRunner?: DependencyCommandRunner;
    inspectors?: DoctorInspectorOverrides;
  } = {},
): Promise<DoctorInspection> {
  const inspectors = { ...DEFAULT_DOCTOR_INSPECTORS, ...options.inspectors };
  const [
    pandoc,
    ffmpeg,
    weasyprint,
    fontconfigDiscovery,
    fontconfigCoverage,
    queryExtensions,
    codexEnvironment,
  ] = await Promise.all([
    inspectors.inspectCommand("pandoc", runtime.platform, options.dependencyRunner),
    inspectors.inspectCommand("ffmpeg", runtime.platform, options.dependencyRunner),
    inspectors.inspectCommand("weasyprint", runtime.platform, options.dependencyRunner),
    inspectors.inspectCommand("fc-list", runtime.platform, options.dependencyRunner),
    inspectors.inspectCommand("fc-query", runtime.platform, options.dependencyRunner),
    inspectors.inspectDataQueryExtensions(),
    inspectors.inspectCodexEnvironment(),
  ]);

  return {
    codexEnvironment,
    ffmpeg,
    fontconfigCoverage,
    fontconfigDiscovery,
    pandoc,
    queryExtensions,
    weasyprint,
  };
}
