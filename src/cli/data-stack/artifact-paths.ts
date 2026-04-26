import { CliError } from "../errors";
import { resolveFromCwd } from "../path-utils";
import type { CliRuntime } from "../types";
import { generateDataStackCodexReportFileName } from "./codex-report";
import { generateDataStackPlanFileName } from "./plan";

interface DataStackDryRunPathReservation {
  label: string;
  path: string;
}

export interface ResolvedDataStackDryRunArtifactPaths {
  codexReportPath?: string;
  planPath: string;
}

export interface DataStackDryRunArtifactPathGenerators {
  codexReport?: (now: Date) => string;
  plan?: (now: Date) => string;
}

function reservePath(
  reservations: Map<string, DataStackDryRunPathReservation>,
  reservation: DataStackDryRunPathReservation,
): void {
  reservations.set(reservation.path, reservation);
}

function reserveExplicitPath(
  reservations: Map<string, DataStackDryRunPathReservation>,
  reservation: DataStackDryRunPathReservation,
): void {
  const existing = reservations.get(reservation.path);
  if (existing) {
    throw new CliError(`${reservation.label} cannot be the same path as ${existing.label}.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  reservePath(reservations, reservation);
}

function resolveGeneratedPath(options: {
  generateFileName: () => string;
  label: string;
  reservations: Map<string, DataStackDryRunPathReservation>;
  runtime: CliRuntime;
}): string {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const path = resolveFromCwd(options.runtime, options.generateFileName());
    if (!options.reservations.has(path)) {
      reservePath(options.reservations, {
        label: options.label,
        path,
      });
      return path;
    }
  }
  throw new CliError("Could not generate a non-conflicting data stack dry-run artifact path.", {
    code: "INVALID_INPUT",
    exitCode: 2,
  });
}

export function resolveDataStackDryRunArtifactPaths(options: {
  codexAssist?: boolean;
  codexReportOutput?: string;
  generators?: DataStackDryRunArtifactPathGenerators;
  outputPath: string;
  planOutput?: string;
  runtime: CliRuntime;
}): ResolvedDataStackDryRunArtifactPaths {
  const reservations = new Map<string, DataStackDryRunPathReservation>();
  reservePath(reservations, {
    label: "--output",
    path: options.outputPath,
  });

  const explicitPlanOutput = options.planOutput?.trim();
  const explicitCodexReportOutput = options.codexReportOutput?.trim();

  let planPath: string | undefined;
  if (explicitPlanOutput) {
    planPath = resolveFromCwd(options.runtime, explicitPlanOutput);
    reserveExplicitPath(reservations, {
      label: "--plan-output",
      path: planPath,
    });
  }

  let codexReportPath: string | undefined;
  if (options.codexAssist && explicitCodexReportOutput) {
    codexReportPath = resolveFromCwd(options.runtime, explicitCodexReportOutput);
    reserveExplicitPath(reservations, {
      label: "--codex-report-output",
      path: codexReportPath,
    });
  }

  if (!planPath) {
    const generatePlanFileName =
      options.generators?.plan ?? ((now: Date) => generateDataStackPlanFileName(now));
    planPath = resolveGeneratedPath({
      generateFileName: () => generatePlanFileName(options.runtime.now()),
      label: "generated --plan-output",
      reservations,
      runtime: options.runtime,
    });
  }

  if (options.codexAssist && !codexReportPath) {
    const generateCodexReportFileName =
      options.generators?.codexReport ?? ((now: Date) => generateDataStackCodexReportFileName(now));
    codexReportPath = resolveGeneratedPath({
      generateFileName: () => generateCodexReportFileName(options.runtime.now()),
      label: "generated --codex-report-output",
      reservations,
      runtime: options.runtime,
    });
  }

  return { codexReportPath, planPath };
}
