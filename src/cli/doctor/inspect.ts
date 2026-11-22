import {
  inspectCodexEnvironment,
  type CodexEnvironmentInspection,
} from "../../adapters/codex/shared";
import {
  assessCommandMinimumVersion,
  inspectCommand,
  type CommandStatus,
  type DependencyCommandRunner,
} from "../deps";
import { inspectDataQueryExtensions } from "../duckdb/query";
import {
  inspectMarkdownPdfProtocolAllowlist,
  MARKDOWN_PDF_RESTRICTED_WEASYPRINT_MINIMUM_VERSION,
} from "../markdown-pdf/requirements";
import { execCommand } from "../process";
import type { CliRuntime } from "../types";
import {
  inspectAdvertisedImageEncoders,
  unknownImageEncoders,
  type ImageEncoders,
} from "../video-frames/encoders";
import { inspectCodexBenchmark, type CodexBenchmarkPrerequisites } from "./codex-benchmark";

export type DoctorQueryInspection = Awaited<ReturnType<typeof inspectDataQueryExtensions>>;

export interface DoctorInspectors {
  inspectCodexBenchmark: typeof inspectCodexBenchmark;
  inspectCodexEnvironment: () => Promise<CodexEnvironmentInspection>;
  inspectCommand: typeof inspectCommand;
  inspectMarkdownPdfProtocolAllowlist: typeof inspectMarkdownPdfProtocolAllowlist;
  inspectAdvertisedImageEncoders: typeof inspectAdvertisedImageEncoders;
  inspectDataQueryExtensions: () => Promise<DoctorQueryInspection>;
}

export type DoctorInspectorOverrides = Partial<DoctorInspectors>;

export interface DoctorInspection {
  codexBenchmark: CodexBenchmarkPrerequisites;
  codexEnvironment: CodexEnvironmentInspection;
  ffmpeg: CommandStatus;
  ffprobe: CommandStatus;
  imageEncoders: ImageEncoders;
  fontconfigCoverage: CommandStatus;
  fontconfigDiscovery: CommandStatus;
  pandoc: CommandStatus;
  queryExtensions: DoctorQueryInspection;
  weasyprint: CommandStatus;
  weasyprintProtocolAllowlist: boolean;
}

const DEFAULT_DOCTOR_INSPECTORS: DoctorInspectors = {
  inspectCodexBenchmark,
  inspectCodexEnvironment,
  inspectCommand,
  inspectMarkdownPdfProtocolAllowlist,
  inspectAdvertisedImageEncoders,
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
  const runner = options.dependencyRunner ?? execCommand;
  const [
    pandoc,
    ffmpeg,
    ffprobe,
    weasyprint,
    fontconfigDiscovery,
    fontconfigCoverage,
    queryExtensions,
    codexEnvironment,
    codexBenchmark,
  ] = await Promise.all([
    inspectors.inspectCommand("pandoc", runtime.platform, options.dependencyRunner),
    inspectors.inspectCommand("ffmpeg", runtime.platform, options.dependencyRunner),
    inspectors.inspectCommand("ffprobe", runtime.platform, options.dependencyRunner),
    inspectors.inspectCommand("weasyprint", runtime.platform, (command, args) =>
      runner(command, args, { cwd: runtime.cwd }),
    ),
    inspectors.inspectCommand("fc-list", runtime.platform, options.dependencyRunner),
    inspectors.inspectCommand("fc-query", runtime.platform, options.dependencyRunner),
    inspectors.inspectDataQueryExtensions(),
    inspectors.inspectCodexEnvironment(),
    inspectors.inspectCodexBenchmark(runtime.cwd),
  ]);

  return {
    codexBenchmark,
    codexEnvironment,
    ffmpeg,
    ffprobe,
    imageEncoders: ffmpeg.available
      ? await inspectors.inspectAdvertisedImageEncoders(options.dependencyRunner)
      : unknownImageEncoders(),
    fontconfigCoverage,
    fontconfigDiscovery,
    pandoc,
    queryExtensions,
    weasyprint,
    weasyprintProtocolAllowlist:
      assessCommandMinimumVersion(weasyprint, MARKDOWN_PDF_RESTRICTED_WEASYPRINT_MINIMUM_VERSION)
        .status === "satisfied" &&
      (await inspectors.inspectMarkdownPdfProtocolAllowlist(runner, runtime.cwd)),
  };
}
