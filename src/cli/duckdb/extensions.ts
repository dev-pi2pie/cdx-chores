import type { DuckDBConnection } from "@duckdb/node-api";
import { homedir } from "node:os";
import { dirname } from "node:path";

import { CliError } from "../errors";

export const DUCKDB_MANAGED_EXTENSION_NAMES = ["sqlite", "excel"] as const;

export type DuckDbManagedExtensionName = (typeof DUCKDB_MANAGED_EXTENSION_NAMES)[number];

export interface DuckDbExtensionProbe {
  detail?: string;
  installed: boolean;
  installable: boolean | null;
  loadable: boolean;
  loaded: boolean;
}

export interface DuckDbManagedExtensionProbe extends DuckDbExtensionProbe {
  cacheDirectory?: string;
  cacheFilePath?: string;
  label: string;
  loadName: string;
  name: DuckDbManagedExtensionName;
  runtimeVersion: string;
  statusName: string;
}

interface DuckDbExtensionCatalogEntry {
  extension_name?: string;
  install_path?: string;
  installed?: boolean;
  loaded?: boolean;
}

interface DuckDbManagedExtensionDefinition {
  label: string;
  loadName: string;
  name: DuckDbManagedExtensionName;
  statusName: string;
}

const DUCKDB_MANAGED_EXTENSION_DEFINITIONS: Record<
  DuckDbManagedExtensionName,
  DuckDbManagedExtensionDefinition
> = {
  sqlite: {
    label: "SQLite",
    loadName: "sqlite",
    name: "sqlite",
    statusName: "sqlite_scanner",
  },
  excel: {
    label: "Excel",
    loadName: "excel",
    name: "excel",
    statusName: "excel",
  },
};

function getDuckDbManagedExtensionDefinition(
  name: DuckDbManagedExtensionName,
): DuckDbManagedExtensionDefinition {
  return DUCKDB_MANAGED_EXTENSION_DEFINITIONS[name];
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function writeStatusLine(stream: NodeJS.WritableStream | undefined, line: string): void {
  stream?.write(`${line}\n`);
}

function resolveDuckDbHomeDirectory(): string | undefined {
  const fromEnv = process.env.HOME?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const fromRuntime = homedir().trim();
  return fromRuntime.length > 0 ? fromRuntime : undefined;
}

function resolveDuckDbCacheLocation(installPath: string | undefined): {
  cacheDirectory?: string;
  cacheFilePath?: string;
} {
  const normalized = installPath?.trim();
  if (!normalized) {
    return {};
  }
  return {
    cacheDirectory: dirname(normalized),
    cacheFilePath: normalized,
  };
}

export function sanitizeDuckDbPathForDisplay(path: string): string {
  const homeDirectory = resolveDuckDbHomeDirectory();
  if (!homeDirectory) {
    return path;
  }
  if (path === homeDirectory) {
    return "$HOME";
  }
  if (path.startsWith(`${homeDirectory}/`)) {
    return `$HOME/${path.slice(homeDirectory.length + 1)}`;
  }
  return path;
}

async function readDuckDbExtensionCatalog(
  connection: DuckDBConnection,
): Promise<Record<string, DuckDbExtensionCatalogEntry>> {
  const reader = await connection.runAndReadAll(
    "select extension_name, install_path, installed, loaded from duckdb_extensions()",
  );
  const rows = reader.getRowObjectsJson() as DuckDbExtensionCatalogEntry[];
  return Object.fromEntries(
    rows
      .map((row) => {
        const name = typeof row.extension_name === "string" ? row.extension_name : undefined;
        if (!name) {
          return undefined;
        }
        return [name, row] as const;
      })
      .filter((entry): entry is readonly [string, DuckDbExtensionCatalogEntry] => Boolean(entry)),
  );
}

export async function getDuckDbRuntimeVersion(connection: DuckDBConnection): Promise<string> {
  const reader = await connection.runAndReadAll("select version() as duckdb_version");
  const rows = reader.getRowObjectsJson() as Array<{ duckdb_version?: string }>;
  const version = rows[0]?.duckdb_version?.trim();
  return version && version.length > 0 ? version : "unknown";
}

function inferInstallability(installed: boolean, detail: string | undefined): boolean | null {
  if (installed) {
    return true;
  }
  if (!detail) {
    return null;
  }
  if (/install it first/i.test(detail) || /not found/i.test(detail)) {
    return true;
  }
  if (
    /operation not permitted/i.test(detail) ||
    /permission denied/i.test(detail) ||
    /failed to create directory/i.test(detail) ||
    /read-only/i.test(detail) ||
    /failed to download extension/i.test(detail) ||
    /could not establish connection/i.test(detail) ||
    /name or service not known/i.test(detail) ||
    /temporary failure in name resolution/i.test(detail)
  ) {
    return false;
  }
  return null;
}

function withDuckDbCacheLocation(
  definition: DuckDbManagedExtensionDefinition,
  runtimeVersion: string,
  probe: DuckDbExtensionProbe,
  installPath?: string,
): DuckDbManagedExtensionProbe {
  const cacheLocation = resolveDuckDbCacheLocation(installPath);
  return {
    ...probe,
    ...cacheLocation,
    label: definition.label,
    loadName: definition.loadName,
    name: definition.name,
    runtimeVersion,
    statusName: definition.statusName,
  };
}

export async function probeDuckDbManagedExtension(
  connection: DuckDBConnection,
  name: DuckDbManagedExtensionName,
): Promise<DuckDbManagedExtensionProbe> {
  const definition = getDuckDbManagedExtensionDefinition(name);
  const runtimeVersion = await getDuckDbRuntimeVersion(connection);
  const catalog = await readDuckDbExtensionCatalog(connection);
  const initial = catalog[definition.statusName];
  if (initial?.loaded) {
    return withDuckDbCacheLocation(
      definition,
      runtimeVersion,
      {
        installed: Boolean(initial.installed),
        installable: Boolean(initial.installed),
        loadable: true,
        loaded: true,
      },
      initial.install_path,
    );
  }

  try {
    await connection.run(`load ${definition.loadName}`);
    const refreshed = (await readDuckDbExtensionCatalog(connection))[definition.statusName];
    return withDuckDbCacheLocation(
      definition,
      runtimeVersion,
      {
        installed: Boolean(refreshed?.installed ?? initial?.installed),
        installable: true,
        loadable: true,
        loaded: true,
      },
      refreshed?.install_path ?? initial?.install_path,
    );
  } catch (error) {
    const detail = toErrorMessage(error);
    return withDuckDbCacheLocation(
      definition,
      runtimeVersion,
      {
        detail,
        installed: Boolean(initial?.installed),
        installable: inferInstallability(Boolean(initial?.installed), detail),
        loadable: false,
        loaded: false,
      },
      initial?.install_path,
    );
  }
}

function formatDuckDbCacheMessage(
  probe: Pick<DuckDbManagedExtensionProbe, "cacheDirectory" | "cacheFilePath">,
): string | undefined {
  if (probe.cacheFilePath) {
    return sanitizeDuckDbPathForDisplay(probe.cacheFilePath);
  }
  if (probe.cacheDirectory) {
    return sanitizeDuckDbPathForDisplay(probe.cacheDirectory);
  }
  return undefined;
}

export function createDuckDbExtensionGuidanceMessage(
  name: DuckDbManagedExtensionName,
  probe: DuckDbManagedExtensionProbe,
): string {
  const definition = getDuckDbManagedExtensionDefinition(name);
  const detail = probe.detail ? ` Detail: ${probe.detail}` : "";
  if (probe.installed) {
    return `${definition.label} query requires the DuckDB ${definition.loadName} extension, but it could not be loaded.${detail}`;
  }
  if (probe.installable === false) {
    return `${definition.label} query requires the DuckDB ${definition.loadName} extension, but the current environment cannot install or cache it.${detail}`;
  }
  return `${definition.label} query requires the DuckDB ${definition.loadName} extension, and it is not installed in the current environment. Install it explicitly in DuckDB, then retry.${detail}`;
}

export function createDuckDbExtensionInstallCommand(name: DuckDbManagedExtensionName): string {
  return `cdx-chores data duckdb extension install ${name}`;
}

function printDuckDbExtensionInstallSuccess(
  stream: NodeJS.WritableStream | undefined,
  before: DuckDbManagedExtensionProbe,
  after: DuckDbManagedExtensionProbe,
): void {
  writeStatusLine(
    stream,
    before.installed
      ? `DuckDB extension already present: ${after.name}`
      : `Installed DuckDB extension: ${after.name}`,
  );
  writeStatusLine(stream, `DuckDB runtime: ${after.runtimeVersion}`);

  const cacheMessage = formatDuckDbCacheMessage(after);
  if (cacheMessage) {
    const label = after.cacheFilePath ? "Extension cache" : "Extension cache directory";
    writeStatusLine(stream, `${label}: ${cacheMessage}`);
  }

  writeStatusLine(stream, `Load check: ${after.loadable ? "ok" : "failed"}`);
}

export async function installDuckDbManagedExtension(
  connection: DuckDBConnection,
  name: DuckDbManagedExtensionName,
  options: { statusStream?: NodeJS.WritableStream } = {},
): Promise<DuckDbManagedExtensionProbe> {
  const definition = getDuckDbManagedExtensionDefinition(name);
  const before = await probeDuckDbManagedExtension(connection, name);

  if (before.loadable) {
    printDuckDbExtensionInstallSuccess(options.statusStream, before, before);
    return before;
  }

  writeStatusLine(
    options.statusStream,
    before.installed
      ? `Refreshing DuckDB extension: ${definition.loadName}`
      : `Installing DuckDB extension: ${definition.loadName}`,
  );

  try {
    await connection.run(
      before.installed ? `force install ${definition.loadName}` : `install ${definition.loadName}`,
    );
  } catch (error) {
    throw new CliError(
      `Failed to install DuckDB ${definition.loadName} extension: ${toErrorMessage(error)}`,
      {
        code: "DUCKDB_EXTENSION_INSTALL_FAILED",
        exitCode: 2,
      },
    );
  }

  const after = await probeDuckDbManagedExtension(connection, name);
  if (!after.loadable) {
    throw new CliError(createDuckDbExtensionGuidanceMessage(name, after), {
      code: "DUCKDB_EXTENSION_UNAVAILABLE",
      exitCode: 2,
    });
  }

  printDuckDbExtensionInstallSuccess(options.statusStream, before, after);
  return after;
}

export async function ensureDuckDbManagedExtensionLoaded(
  connection: DuckDBConnection,
  name: DuckDbManagedExtensionName,
  options: { installIfMissing?: boolean; statusStream?: NodeJS.WritableStream } = {},
): Promise<DuckDbManagedExtensionProbe> {
  const probe = await probeDuckDbManagedExtension(connection, name);
  if (probe.loadable) {
    return probe;
  }

  if (options.installIfMissing && probe.installable === true) {
    return await installDuckDbManagedExtension(connection, name, {
      statusStream: options.statusStream,
    });
  }

  throw new CliError(createDuckDbExtensionGuidanceMessage(name, probe), {
    code: "DUCKDB_EXTENSION_UNAVAILABLE",
    exitCode: 2,
  });
}
