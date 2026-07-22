import type { MarkdownPdfCodexReportBinding } from "../../markdown-pdf";
import {
  bindMarkdownPdfProfileCodexDestination,
  commitPreparedMarkdownPdfProfileCodex,
  prepareMarkdownPdfProfileCodex,
  type BoundMarkdownPdfProfileCodexDestination,
} from "../../markdown-pdf/profile-codex";
import {
  prepareMdPdfProjectCodex,
  rebindMdPdfProjectCodexPreparedArtifact,
  writePreparedMdPdfProjectCodexBundle,
} from "../../markdown-pdf/project-codex";
import {
  prepareMdPdfTemplateCodex,
  rebindPreparedMdPdfTemplateCodexArtifact,
  writePreparedMdPdfTemplateCodexBundle,
} from "../../markdown-pdf/template-codex";
import type { CliRuntime } from "../../types";
import type {
  MarkdownPdfCodexReportRetention,
  MarkdownPdfCodexSetup,
  PreparedMarkdownPdfCodexCandidate,
} from "./codex-types";

export type BoundMarkdownPdfCodexCandidate =
  | {
      artifact: "profile";
      candidate: Extract<PreparedMarkdownPdfCodexCandidate, { artifact: "profile" }>;
      destination: BoundMarkdownPdfProfileCodexDestination;
    }
  | {
      artifact: "template-bundle";
      candidate: Extract<PreparedMarkdownPdfCodexCandidate, { artifact: "template-bundle" }>;
    }
  | {
      artifact: "project-bundle";
      candidate: Extract<PreparedMarkdownPdfCodexCandidate, { artifact: "project-bundle" }>;
    };

function reportBinding(report: MarkdownPdfCodexReportRetention): MarkdownPdfCodexReportBinding {
  return report;
}

export async function prepareMarkdownPdfCodexCandidate(
  runtime: CliRuntime,
  setup: MarkdownPdfCodexSetup,
): Promise<PreparedMarkdownPdfCodexCandidate> {
  const common = {
    input: setup.sample,
    intent: setup.intent,
    fontHint: setup.fontHints,
    baseProfile: setup.baseProfile,
    dryRun: true,
    keepCodexReport: false,
  };
  if (setup.artifact === "profile") {
    return {
      artifact: setup.artifact,
      prepared: await prepareMarkdownPdfProfileCodex(runtime, common),
      setup,
    };
  }
  if (setup.artifact === "template-bundle") {
    return {
      artifact: setup.artifact,
      prepared: await prepareMdPdfTemplateCodex(runtime, {
        ...common,
        coverImage: setup.coverImage,
      }),
      setup,
    };
  }
  return {
    artifact: setup.artifact,
    prepared: await prepareMdPdfProjectCodex(runtime, {
      ...common,
      coverImage: setup.coverImage,
    }),
    setup,
  };
}

export function suggestedMarkdownPdfCodexOutputPath(
  candidate: PreparedMarkdownPdfCodexCandidate,
): string {
  if (candidate.artifact === "profile") {
    return candidate.prepared.suggestedOutputPath;
  }
  if (candidate.artifact === "template-bundle") {
    return candidate.prepared.outputPlan.outputDirectory;
  }
  return candidate.prepared.binding.outputPlan.outputDirectory;
}

export async function bindMarkdownPdfCodexCandidate(
  runtime: CliRuntime,
  candidate: PreparedMarkdownPdfCodexCandidate,
  input: {
    output: string;
    overwrite: boolean;
    report: MarkdownPdfCodexReportRetention;
  },
): Promise<BoundMarkdownPdfCodexCandidate> {
  if (candidate.artifact === "profile") {
    return {
      artifact: candidate.artifact,
      candidate,
      destination: await bindMarkdownPdfProfileCodexDestination(runtime, candidate.prepared, {
        dryRun: false,
        output: input.output,
        overwrite: input.overwrite,
        report: reportBinding(input.report),
      }),
    };
  }
  if (candidate.artifact === "template-bundle") {
    return {
      artifact: candidate.artifact,
      candidate: {
        ...candidate,
        prepared: await rebindPreparedMdPdfTemplateCodexArtifact({
          outputDirectory: input.output,
          overwrite: input.overwrite,
          prepared: candidate.prepared,
          report: reportBinding(input.report),
          runtime,
        }),
      },
    };
  }
  return {
    artifact: candidate.artifact,
    candidate: {
      ...candidate,
      prepared: await rebindMdPdfProjectCodexPreparedArtifact({
        dryRun: false,
        outputDirectory: input.output,
        overwrite: input.overwrite,
        prepared: candidate.prepared,
        report: reportBinding(input.report),
        runtime,
      }),
    },
  };
}

export function boundMarkdownPdfCodexOutputPath(bound: BoundMarkdownPdfCodexCandidate): string {
  if (bound.artifact === "profile") {
    return bound.destination.outputPath;
  }
  if (bound.artifact === "template-bundle") {
    return bound.candidate.prepared.outputPlan.outputDirectory;
  }
  return bound.candidate.prepared.binding.outputPlan.outputDirectory;
}

export function boundMarkdownPdfCodexOutputFiles(bound: BoundMarkdownPdfCodexCandidate): string[] {
  if (bound.artifact === "profile") {
    return [
      bound.destination.outputPath,
      ...(bound.destination.reportOutputPath ? [bound.destination.reportOutputPath] : []),
    ];
  }
  if (bound.artifact === "template-bundle") {
    const prepared = bound.candidate.prepared;
    return [
      prepared.outputPlan.templateHtml.path,
      prepared.outputPlan.styleCss.path,
      ...prepared.outputPlan.assets.map((asset) => asset.path),
      ...(prepared.outputPlan.report ? [prepared.outputPlan.report.path] : []),
    ];
  }
  const prepared = bound.candidate.prepared;
  return [
    prepared.binding.outputPlan.profile.path,
    prepared.binding.outputPlan.templateHtml.path,
    prepared.binding.outputPlan.styleCss.path,
    ...prepared.binding.outputPlan.assets.map((asset) => asset.path),
    ...(prepared.binding.outputPlan.report ? [prepared.binding.outputPlan.report.path] : []),
  ];
}

export async function writeBoundMarkdownPdfCodexCandidate(
  runtime: CliRuntime,
  bound: BoundMarkdownPdfCodexCandidate,
): Promise<void> {
  if (bound.artifact === "profile") {
    await commitPreparedMarkdownPdfProfileCodex({
      destination: bound.destination,
      prepared: bound.candidate.prepared,
      runtime,
    });
    return;
  }
  if (bound.artifact === "template-bundle") {
    await writePreparedMdPdfTemplateCodexBundle({
      prepared: bound.candidate.prepared,
      runtime,
    });
    return;
  }
  await writePreparedMdPdfProjectCodexBundle(runtime, bound.candidate.prepared);
}
