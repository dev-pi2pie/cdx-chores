import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import {
  bindMarkdownPdfCodexCandidate,
  boundMarkdownPdfCodexOutputFiles,
  boundMarkdownPdfCodexOutputPath,
  writeBoundMarkdownPdfCodexCandidate,
  type BoundMarkdownPdfCodexCandidate,
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
  type BoundMarkdownPdfDeterministicRecipe,
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

export interface MarkdownPdfMaterializationServices<
  CodexBound extends object = object,
  DeterministicBound extends object = object,
> {
  readonly bindCodex: (
    runtime: CliRuntime,
    candidate: PreparedMarkdownPdfCodexCandidate,
    input: {
      output: string;
      overwrite: boolean;
      report: MarkdownPdfCodexReportRetention;
    },
  ) => Promise<CodexBound>;
  readonly bindDeterministic: (
    runtime: CliRuntime,
    candidate: PreparedMarkdownPdfDeterministicRecipe,
    input: { output: string; overwrite?: boolean },
  ) => Promise<DeterministicBound>;
  readonly codexOutputFiles: (bound: CodexBound) => string[];
  readonly codexOutputPath: (bound: CodexBound) => string;
  readonly deterministicOutputFiles: (bound: DeterministicBound) => string[];
  readonly deterministicOutputPath: (bound: DeterministicBound) => string;
  readonly writeCodex: (runtime: CliRuntime, bound: CodexBound) => Promise<void>;
  readonly writeDeterministic: (bound: DeterministicBound) => Promise<void>;
}

interface BoundMaterializationRecord {
  state: "pending" | "writing" | "written";
  readonly write: () => Promise<void>;
}

const boundMaterializations = new WeakMap<
  BoundMarkdownPdfGeneratedMaterialization,
  BoundMaterializationRecord
>();

const defaultServices: MarkdownPdfMaterializationServices<
  BoundMarkdownPdfCodexCandidate,
  BoundMarkdownPdfDeterministicRecipe
> = {
  bindCodex: async (runtime, candidate, input) =>
    await bindMarkdownPdfCodexCandidate(runtime, candidate, input),
  bindDeterministic: async (runtime, candidate, input) =>
    await bindMarkdownPdfDeterministicRecipeDestination(runtime, candidate, input),
  codexOutputFiles: boundMarkdownPdfCodexOutputFiles,
  codexOutputPath: boundMarkdownPdfCodexOutputPath,
  deterministicOutputFiles: markdownPdfDeterministicOutputFiles,
  deterministicOutputPath: markdownPdfDeterministicDestinationPath,
  writeCodex: writeBoundMarkdownPdfCodexCandidate,
  writeDeterministic: writeBoundMarkdownPdfDeterministicRecipe,
};

interface MaterializationBinding {
  readonly destination: string;
  readonly outputFiles: readonly string[];
  readonly write: () => Promise<void>;
}

interface MarkdownPdfCodexMaterializationAdapter<CodexBound extends object> {
  readonly bindCodex: MarkdownPdfMaterializationServices<CodexBound>["bindCodex"];
  readonly codexOutputFiles: MarkdownPdfMaterializationServices<CodexBound>["codexOutputFiles"];
  readonly codexOutputPath: MarkdownPdfMaterializationServices<CodexBound>["codexOutputPath"];
  readonly writeCodex: MarkdownPdfMaterializationServices<CodexBound>["writeCodex"];
}

interface MarkdownPdfDeterministicMaterializationAdapter<DeterministicBound extends object> {
  readonly bindDeterministic: MarkdownPdfMaterializationServices<
    object,
    DeterministicBound
  >["bindDeterministic"];
  readonly deterministicOutputFiles: MarkdownPdfMaterializationServices<
    object,
    DeterministicBound
  >["deterministicOutputFiles"];
  readonly deterministicOutputPath: MarkdownPdfMaterializationServices<
    object,
    DeterministicBound
  >["deterministicOutputPath"];
  readonly writeDeterministic: MarkdownPdfMaterializationServices<
    object,
    DeterministicBound
  >["writeDeterministic"];
}

async function bindCodexMaterialization<CodexBound extends object>(
  runtime: CliRuntime,
  candidate: PreparedMarkdownPdfCodexCandidate,
  target: Extract<
    MarkdownPdfGeneratedMaterializationDestination,
    { kind: "durable" | "temporary" }
  >,
  services: MarkdownPdfCodexMaterializationAdapter<CodexBound>,
  output: string,
  overwrite: boolean,
): Promise<MaterializationBinding> {
  const bound = await services.bindCodex(runtime, candidate, {
    output,
    overwrite,
    report: target.report,
  });
  return {
    destination: services.codexOutputPath(bound),
    outputFiles: Object.freeze([...services.codexOutputFiles(bound)]),
    write: async () => await services.writeCodex(runtime, bound),
  };
}

async function bindDeterministicMaterialization<DeterministicBound extends object>(
  runtime: CliRuntime,
  candidate: PreparedMarkdownPdfDeterministicRecipe,
  services: MarkdownPdfDeterministicMaterializationAdapter<DeterministicBound>,
  output: string,
  overwrite: boolean,
): Promise<MaterializationBinding> {
  const bound = await services.bindDeterministic(runtime, candidate, { output, overwrite });
  return {
    destination: services.deterministicOutputPath(bound),
    outputFiles: Object.freeze([...services.deterministicOutputFiles(bound)]),
    write: async () => await services.writeDeterministic(bound),
  };
}

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

async function bindPreparedMarkdownPdfGeneratedCandidateWithServices<
  CodexBound extends object,
  DeterministicBound extends object,
>(
  runtime: CliRuntime,
  acceptedCandidate: PreparedMarkdownPdfGeneratedCandidate,
  target: MarkdownPdfGeneratedMaterializationDestination,
  services: MarkdownPdfMaterializationServices<CodexBound, DeterministicBound>,
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
  let binding: MaterializationBinding;

  if (acceptedCandidate.kind === "deterministic") {
    binding = await bindDeterministicMaterialization(
      runtime,
      acceptedCandidate.candidate,
      services,
      output,
      overwrite,
    );
  } else {
    binding = await bindCodexMaterialization(
      runtime,
      acceptedCandidate.candidate,
      target,
      services,
      output,
      overwrite,
    );
  }

  if (target.kind === "temporary") {
    assertTemporaryPaths({
      destination: binding.destination,
      outputFiles: binding.outputFiles,
      report: target.report,
      runtime,
      session: target.session,
    });
  }

  const common = {
    acceptedCandidate,
    destination: binding.destination,
    outputFiles: binding.outputFiles,
    rendererSource: Object.freeze(rendererSource(acceptedCandidate, binding.destination)),
  };
  const materialization: BoundMarkdownPdfGeneratedMaterialization = Object.freeze(
    target.kind === "temporary"
      ? { ...common, kind: "temporary" as const, session: target.session }
      : { ...common, kind: "durable" as const },
  );
  boundMaterializations.set(materialization, { state: "pending", write: binding.write });
  return materialization;
}

export function bindPreparedMarkdownPdfGeneratedCandidate(
  runtime: CliRuntime,
  acceptedCandidate: PreparedMarkdownPdfGeneratedCandidate,
  target: MarkdownPdfGeneratedMaterializationDestination,
): Promise<BoundMarkdownPdfGeneratedMaterialization>;
export function bindPreparedMarkdownPdfGeneratedCandidate<
  CodexBound extends object,
  DeterministicBound extends object,
>(
  runtime: CliRuntime,
  acceptedCandidate: PreparedMarkdownPdfGeneratedCandidate,
  target: MarkdownPdfGeneratedMaterializationDestination,
  services: MarkdownPdfMaterializationServices<CodexBound, DeterministicBound>,
): Promise<BoundMarkdownPdfGeneratedMaterialization>;
export async function bindPreparedMarkdownPdfGeneratedCandidate<
  CodexBound extends object,
  DeterministicBound extends object,
>(
  runtime: CliRuntime,
  acceptedCandidate: PreparedMarkdownPdfGeneratedCandidate,
  target: MarkdownPdfGeneratedMaterializationDestination,
  services?: MarkdownPdfMaterializationServices<CodexBound, DeterministicBound>,
): Promise<BoundMarkdownPdfGeneratedMaterialization> {
  return services
    ? await bindPreparedMarkdownPdfGeneratedCandidateWithServices(
        runtime,
        acceptedCandidate,
        target,
        services,
      )
    : await bindPreparedMarkdownPdfGeneratedCandidateWithServices(
        runtime,
        acceptedCandidate,
        target,
        defaultServices,
      );
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
