import { getCliColors } from "../colors";
import {
  createDuckDbExtensionInstallCommand,
  DUCKDB_MANAGED_EXTENSION_NAMES,
  installDuckDbManagedExtension,
  probeDuckDbManagedExtension,
  sanitizeDuckDbPathForDisplay,
  type DuckDbManagedExtensionName,
  type DuckDbManagedExtensionProbe,
} from "../duckdb/extensions";
import { createDuckDbConnection } from "../duckdb/query";
import { CliError } from "../errors";
import type { CliRuntime } from "../types";
import { printLine } from "./shared";

export interface DataDuckDbDoctorOptions {
  json?: boolean;
}

export interface DataDuckDbExtensionInstallOptions {
  allSupported?: boolean;
  extensionName?: DuckDbManagedExtensionName;
}

function formatInstallability(value: boolean | null): string {
  if (value === null) {
    return "unknown";
  }
  return value ? "yes" : "no";
}

function buildDuckDbDoctorPayload(
  runtime: CliRuntime,
  probes: readonly DuckDbManagedExtensionProbe[],
) {
  return {
    generatedAt: runtime.now().toISOString(),
    duckdb: {
      runtimeVersion: probes[0]?.runtimeVersion ?? "unknown",
      extensions: Object.fromEntries(
        probes.map((probe) => [
          probe.name,
          {
            cacheDirectory: probe.cacheDirectory
              ? sanitizeDuckDbPathForDisplay(probe.cacheDirectory)
              : undefined,
            cacheFilePath: probe.cacheFilePath
              ? sanitizeDuckDbPathForDisplay(probe.cacheFilePath)
              : undefined,
            detail: probe.detail,
            installability: probe.installable,
            installed: probe.installed,
            loadability: probe.loadable,
            loaded: probe.loaded,
          },
        ]),
      ),
    },
  };
}

function renderDuckDbProbe(runtime: CliRuntime, probe: DuckDbManagedExtensionProbe): void {
  const pc = getCliColors(runtime);
  printLine(
    runtime.stdout,
    `- ${pc.bold(probe.name)}: installed=${probe.installed ? "yes" : "no"}, loadability=${probe.loadable ? "yes" : "no"}, installability=${formatInstallability(probe.installable)}`,
  );

  if (probe.cacheFilePath) {
    printLine(
      runtime.stdout,
      `  ${pc.dim(`Cache: ${sanitizeDuckDbPathForDisplay(probe.cacheFilePath)}`)}`,
    );
  } else if (probe.cacheDirectory) {
    printLine(
      runtime.stdout,
      `  ${pc.dim(`Cache directory: ${sanitizeDuckDbPathForDisplay(probe.cacheDirectory)}`)}`,
    );
  }

  if (probe.detail) {
    printLine(runtime.stdout, `  ${pc.dim(probe.detail)}`);
  }

  if (!probe.loadable && probe.installable === true) {
    printLine(
      runtime.stdout,
      `  ${pc.yellow(`Try: ${createDuckDbExtensionInstallCommand(probe.name)}`)}`,
    );
  }
}

export async function actionDataDuckDbDoctor(
  runtime: CliRuntime,
  options: DataDuckDbDoctorOptions = {},
): Promise<void> {
  let connection: Awaited<ReturnType<typeof createDuckDbConnection>> | undefined;
  try {
    connection = await createDuckDbConnection();
    const activeConnection = connection;
    const probes = await Promise.all(
      DUCKDB_MANAGED_EXTENSION_NAMES.map((name) =>
        probeDuckDbManagedExtension(activeConnection, name),
      ),
    );

    if (options.json) {
      printLine(runtime.stdout, JSON.stringify(buildDuckDbDoctorPayload(runtime, probes), null, 2));
      return;
    }

    const pc = getCliColors(runtime);
    printLine(runtime.stdout, pc.bold(pc.cyan("cdx-chores data duckdb doctor")));
    printLine(runtime.stdout, `${pc.dim("Platform:")} ${pc.white(runtime.platform)}`);
    printLine(runtime.stdout, `${pc.dim("Node.js:")} ${pc.white(process.version)}`);
    printLine(
      runtime.stdout,
      `${pc.dim("DuckDB runtime:")} ${pc.white(probes[0]?.runtimeVersion ?? "unknown")}`,
    );
    printLine(runtime.stdout);
    printLine(runtime.stdout, pc.bold(pc.cyan("Managed extensions:")));

    for (const probe of probes) {
      renderDuckDbProbe(runtime, probe);
    }
  } finally {
    connection?.closeSync();
  }
}

function resolveDuckDbInstallTargets(
  options: DataDuckDbExtensionInstallOptions,
): DuckDbManagedExtensionName[] {
  if (options.allSupported) {
    return [...DUCKDB_MANAGED_EXTENSION_NAMES];
  }
  if (options.extensionName) {
    return [options.extensionName];
  }
  return [];
}

export async function actionDataDuckDbExtensionInstall(
  runtime: CliRuntime,
  options: DataDuckDbExtensionInstallOptions,
): Promise<void> {
  const targets = resolveDuckDbInstallTargets(options);
  if (targets.length === 0) {
    throw new CliError(
      `Extension name is required unless --all-supported is used. Supported names: ${DUCKDB_MANAGED_EXTENSION_NAMES.join(", ")}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  let connection: Awaited<ReturnType<typeof createDuckDbConnection>> | undefined;
  try {
    connection = await createDuckDbConnection();
    for (const [index, name] of targets.entries()) {
      if (index > 0) {
        printLine(runtime.stdout);
      }
      await installDuckDbManagedExtension(connection, name, {
        statusStream: runtime.stdout,
      });
    }
  } finally {
    connection?.closeSync();
  }
}
