import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import {
  bindMarkdownPdfCodexCandidate,
  boundMarkdownPdfCodexOutputFiles,
  boundMarkdownPdfCodexOutputPath,
  writeBoundMarkdownPdfCodexCandidate,
} from "./codex-service";
import type {
  MarkdownPdfCodexReportRetention,
  PreparedMarkdownPdfCodexCandidate,
  PreparedMarkdownPdfGeneratedCandidate,
} from "./codex-types";
import {
  bindMarkdownPdfDeterministicRecipeDestination,
  markdownPdfDeterministicDestinationPath,
  markdownPdfDeterministicOutputFiles,
  writeBoundMarkdownPdfDeterministicRecipe,
  type PreparedMarkdownPdfDeterministicRecipe,
} from "./deterministic-authoring";
import { assertActiveOwnedMarkdownPdfSession, type OwnedMarkdownPdfSession } from "./lifecycle";

export type MarkdownPdfMaterializedRendererSource =
  | { readonly profile: string }
  | { readonly bundle: string };

interface BoundMarkdownPdfGeneratedMaterializationBase {
  readonly acceptedCandidate: PreparedMarkdownPdfGeneratedCandidate;
  readonly destination: string;
  readonly outputFiles: readonly string[];
  readonly rendererSource: MarkdownPdfMaterializedRendererSource;
}

export type BoundMarkdownPdfGeneratedMaterialization =
  | (BoundMarkdownPdfGeneratedMaterializationBase & {
      readonly kind: "temporary";
      readonly session: OwnedMarkdownPdfSession;
    })
  | (BoundMarkdownPdfGeneratedMaterializationBase & {
      readonly kind: "durable";
    });

export type MarkdownPdfGeneratedMaterializationDestination =
  | {
      readonly kind: "temporary";
      readonly report: Exclude<MarkdownPdfCodexReportRetention, { kind: "with-artifact" }>;
      readonly session: OwnedMarkdownPdfSession;
    }
  | {
      readonly kind: "durable";
      readonly output: string;
      readonly overwrite: boolean;
      readonly report: MarkdownPdfCodexReportRetention;
    };

export interface MarkdownPdfMaterializationServices {
  readonly bindCodex: (
    runtime: CliRuntime,
    candidate: PreparedMarkdownPdfCodexCandidate,
    input: {
      output: string;
      overwrite: boolean;
      report: MarkdownPdfCodexReportRetention;
    },
  ) => Promise<unknown>;
  readonly bindDeterministic: (
    runtime: CliRuntime,
    candidate: PreparedMarkdownPdfDeterministicRecipe,
    input: { output: string; overwrite?: boolean },
  ) => Promise<unknown>;
  readonly codexOutputFiles: (bound: unknown) => string[];
  readonly codexOutputPath: (bound: unknown) => string;
  readonly deterministicOutputFiles: (bound: unknown) => string[];
  readonly deterministicOutputPath: (bound: unknown) => string;
  readonly writeCodex: (runtime: CliRuntime, bound: unknown) => Promise<void>;
  readonly writeDeterministic: (bound: unknown) => Promise<void>;
}

interface BoundMaterializationRecord {
  state: "pending" | "writing" | "written";
  readonly write: () => Promise<void>;
}

const boundMaterializations = new WeakMap<
  BoundMarkdownPdfGeneratedMaterialization,
  BoundMaterializationRecord
>();

const defaultServices: MarkdownPdfMaterializationServices = {
  bindCodex: async (runtime, candidate, input) =>
    await bindMarkdownPdfCodexCandidate(runtime, candidate, input),
  bindDeterministic: async (runtime, candidate, input) =>
    await bindMarkdownPdfDeterministicRecipeDestination(runtime, candidate, input),
  codexOutputFiles: (bound) =>
    boundMarkdownPdfCodexOutputFiles(
      bound as Awaited<ReturnType<typeof bindMarkdownPdfCodexCandidate>>,
    ),
  codexOutputPath: (bound) =>
    boundMarkdownPdfCodexOutputPath(
      bound as Awaited<ReturnType<typeof bindMarkdownPdfCodexCandidate>>,
    ),
  deterministicOutputFiles: (bound) =>
    markdownPdfDeterministicOutputFiles(
      bound as Awaited<ReturnType<typeof bindMarkdownPdfDeterministicRecipeDestination>>,
    ),
  deterministicOutputPath: (bound) =>
    markdownPdfDeterministicDestinationPath(
      bound as Awaited<ReturnType<typeof bindMarkdownPdfDeterministicRecipeDestination>>,
    ),
  writeCodex: async (runtime, bound) =>
    await writeBoundMarkdownPdfCodexCandidate(
      runtime,
      bound as Awaited<ReturnType<typeof bindMarkdownPdfCodexCandidate>>,
    ),
  writeDeterministic: async (bound) =>
    await writeBoundMarkdownPdfDeterministicRecipe(
      bound as Awaited<ReturnType<typeof bindMarkdownPdfDeterministicRecipeDestination>>,
    ),
};

function temporaryDestination(
  candidate: PreparedMarkdownPdfGeneratedCandidate,
  session: OwnedMarkdownPdfSession,
): string {
  const artifact = candidate.candidate.artifact;
  return artifact === "profile"
    ? join(session.path, "profile.yml")
    : join(session.path, artifact === "template-bundle" ? "template-bundle" : "project-bundle");
}

function isWithin(root: string, path: string): boolean {
  const child = relative(resolve(root), resolve(path));
  return child !== "" && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function isWithinOrEqual(root: string, path: string): boolean {
  return resolve(root) === resolve(path) || isWithin(root, path);
}

function invalidMaterialization(message: string): CliError {
  return new CliError(message, { code: "INVALID_INPUT", exitCode: 2 });
}

function assertTemporaryPaths(input: {
  destination: string;
  outputFiles: readonly string[];
  report: Exclude<MarkdownPdfCodexReportRetention, { kind: "with-artifact" }>;
  runtime: CliRuntime;
  session: OwnedMarkdownPdfSession;
}): void {
  if (!isWithin(input.session.path, input.destination)) {
    throw invalidMaterialization(
      "Temporary Markdown PDF artifact destination escaped its owned session.",
    );
  }
  const externalReport =
    input.report.kind === "external" ? resolve(input.runtime.cwd, input.report.path) : undefined;
  if (externalReport && isWithinOrEqual(input.session.path, externalReport)) {
    throw invalidMaterialization(
      "Temporary Markdown PDF external report must be outside its owned session.",
    );
  }
  for (const outputFile of input.outputFiles) {
    const resolvedOutput = resolve(outputFile);
    if (
      !isWithin(input.session.path, resolvedOutput) &&
      (!externalReport || resolvedOutput !== externalReport)
    ) {
      throw invalidMaterialization("Temporary Markdown PDF output escaped its owned session.");
    }
  }
}

function rendererSource(
  candidate: PreparedMarkdownPdfGeneratedCandidate,
  destination: string,
): MarkdownPdfMaterializedRendererSource {
  return candidate.candidate.artifact === "profile"
    ? { profile: destination }
    : { bundle: destination };
}

export async function bindPreparedMarkdownPdfGeneratedCandidate(
  runtime: CliRuntime,
  acceptedCandidate: PreparedMarkdownPdfGeneratedCandidate,
  target: MarkdownPdfGeneratedMaterializationDestination,
  services: MarkdownPdfMaterializationServices = defaultServices,
): Promise<BoundMarkdownPdfGeneratedMaterialization> {
  if (target.kind === "temporary") {
    assertActiveOwnedMarkdownPdfSession(target.session);
    if ((target.report as MarkdownPdfCodexReportRetention).kind === "with-artifact") {
      throw invalidMaterialization(
        "Temporary Markdown PDF materialization cannot retain a report with the artifact.",
      );
    }
  }

  const output =
    target.kind === "temporary"
      ? temporaryDestination(acceptedCandidate, target.session)
      : target.output;
  const overwrite = target.kind === "durable" ? target.overwrite : false;
  let bound: unknown;
  let destination: string;
  let outputFiles: string[];
  let write: () => Promise<void>;

  if (acceptedCandidate.kind === "deterministic") {
    bound = await services.bindDeterministic(runtime, acceptedCandidate.candidate, {
      output,
      overwrite,
    });
    destination = services.deterministicOutputPath(bound);
    outputFiles = services.deterministicOutputFiles(bound);
    write = async () => await services.writeDeterministic(bound);
  } else {
    bound = await services.bindCodex(runtime, acceptedCandidate.candidate, {
      output,
      overwrite,
      report: target.report,
    });
    destination = services.codexOutputPath(bound);
    outputFiles = services.codexOutputFiles(bound);
    write = async () => await services.writeCodex(runtime, bound);
  }

  if (target.kind === "temporary") {
    assertTemporaryPaths({
      destination,
      outputFiles,
      report: target.report,
      runtime,
      session: target.session,
    });
  }

  const common = {
    acceptedCandidate,
    destination,
    outputFiles: Object.freeze([...outputFiles]),
    rendererSource: Object.freeze(rendererSource(acceptedCandidate, destination)),
  };
  const materialization: BoundMarkdownPdfGeneratedMaterialization = Object.freeze(
    target.kind === "temporary"
      ? { ...common, kind: "temporary" as const, session: target.session }
      : { ...common, kind: "durable" as const },
  );
  boundMaterializations.set(materialization, { state: "pending", write });
  return materialization;
}

export async function writeBoundMarkdownPdfGeneratedCandidate(
  materialization: BoundMarkdownPdfGeneratedMaterialization,
): Promise<void> {
  const record = boundMaterializations.get(materialization);
  if (!record) {
    throw new TypeError("Expected a bound Markdown PDF generated-candidate materialization.");
  }
  if (record.state !== "pending") {
    throw new TypeError(`Markdown PDF materialization is already ${record.state}.`);
  }
  if (materialization.kind === "temporary") {
    assertActiveOwnedMarkdownPdfSession(materialization.session);
  }
  record.state = "writing";
  try {
    await record.write();
    record.state = "written";
  } catch (error) {
    record.state = "pending";
    throw error;
  }
}
