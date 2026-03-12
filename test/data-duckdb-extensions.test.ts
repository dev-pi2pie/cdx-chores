import { describe, expect, test } from "bun:test";
import type { DuckDBConnection } from "@duckdb/node-api";

import {
  ensureDuckDbManagedExtensionLoaded,
  installDuckDbManagedExtension,
} from "../src/cli/duckdb/extensions";
import { CaptureStream, createCapturedRuntime } from "./helpers/cli-test-utils";
import { CliError } from "../src/cli/errors";

type FakeExtensionStatusName = "excel" | "sqlite_scanner";

interface FakeExtensionState {
  broken?: boolean;
  installed: boolean;
  installPath: string;
  loaded: boolean;
}

class FakeDuckDbConnection {
  public readonly version = "v1.5.0";
  private readonly extensions: Record<FakeExtensionStatusName, FakeExtensionState>;
  private readonly installFailures: Partial<Record<FakeExtensionStatusName, string>>;

  constructor(options: {
    extensions: Record<FakeExtensionStatusName, FakeExtensionState>;
    installFailures?: Partial<Record<FakeExtensionStatusName, string>>;
  }) {
    this.extensions = {
      excel: { ...options.extensions.excel },
      sqlite_scanner: { ...options.extensions.sqlite_scanner },
    };
    this.installFailures = { ...options.installFailures };
  }

  async run(sql: string): Promise<void> {
    const normalized = sql.trim().toLowerCase();
    if (normalized === "force install excel") {
      this.install("excel", { force: true });
      return;
    }
    if (normalized === "force install sqlite") {
      this.install("sqlite_scanner", { force: true });
      return;
    }
    if (normalized === "load excel") {
      this.load("excel");
      return;
    }
    if (normalized === "load sqlite") {
      this.load("sqlite_scanner");
      return;
    }
    if (normalized === "install excel") {
      this.install("excel");
      return;
    }
    if (normalized === "install sqlite") {
      this.install("sqlite_scanner");
      return;
    }
    throw new Error(`Unsupported SQL in fake DuckDB connection: ${sql}`);
  }

  async runAndReadAll(sql: string): Promise<{ getRowObjectsJson(): unknown[] }> {
    const normalized = sql.trim().toLowerCase();
    if (normalized === "select version() as duckdb_version") {
      return {
        getRowObjectsJson: () => [{ duckdb_version: this.version }],
      };
    }
    if (normalized === "select extension_name, install_path, installed, loaded from duckdb_extensions()") {
      return {
        getRowObjectsJson: () => [
          {
            extension_name: "excel",
            install_path: this.extensions.excel.installPath,
            installed: this.extensions.excel.installed,
            loaded: this.extensions.excel.loaded,
          },
          {
            extension_name: "sqlite_scanner",
            install_path: this.extensions.sqlite_scanner.installPath,
            installed: this.extensions.sqlite_scanner.installed,
            loaded: this.extensions.sqlite_scanner.loaded,
          },
        ],
      };
    }
    throw new Error(`Unsupported read SQL in fake DuckDB connection: ${sql}`);
  }

  private install(name: FakeExtensionStatusName, options: { force?: boolean } = {}): void {
    const failure = this.installFailures[name];
    if (failure) {
      throw new Error(failure);
    }
    if (this.extensions[name].installed && !options.force) {
      return;
    }
    this.extensions[name].installed = true;
    this.extensions[name].broken = false;
  }

  private load(name: FakeExtensionStatusName): void {
    if (!this.extensions[name].installed) {
      const extensionName = name === "sqlite_scanner" ? "sqlite" : "excel";
      throw new Error(
        `IO Error: Extension "fake/${extensionName}.duckdb_extension" not found.\nInstall it first using "INSTALL ${extensionName}".`,
      );
    }
    if (this.extensions[name].broken) {
      throw new Error(`IO Error: Failed to load extension "${name}" because the cached binary is incompatible.`);
    }
    this.extensions[name].loaded = true;
  }
}

function createStatusStream(): CaptureStream {
  return createCapturedRuntime().stderr;
}

function createFakeExtensionState(
  installPath: string,
  options: Omit<FakeExtensionState, "installPath">,
): FakeExtensionState {
  return {
    installPath,
    ...options,
  };
}

describe("DuckDB extension lifecycle helpers", () => {
  test("installs and loads an installable missing extension", async () => {
    const connection = new FakeDuckDbConnection({
      extensions: {
        excel: createFakeExtensionState("/tmp/fake-duckdb/v1.5.0/osx_arm64/excel.duckdb_extension", {
          installed: false,
          loaded: false,
        }),
        sqlite_scanner: createFakeExtensionState(
          "/tmp/fake-duckdb/v1.5.0/osx_arm64/sqlite_scanner.duckdb_extension",
          {
            installed: true,
            loaded: false,
          },
        ),
      },
    });
    const statusStream = createStatusStream();

    const probe = await ensureDuckDbManagedExtensionLoaded(
      connection as unknown as DuckDBConnection,
      "excel",
      { installIfMissing: true, statusStream: statusStream as unknown as NodeJS.WritableStream },
    );

    expect(probe.installed).toBe(true);
    expect(probe.cacheFilePath).toBe("/tmp/fake-duckdb/v1.5.0/osx_arm64/excel.duckdb_extension");
    expect(probe.loadable).toBe(true);
    expect(statusStream.text).toContain("Installing DuckDB extension: excel");
    expect(statusStream.text).toContain("Installed DuckDB extension: excel");
    expect(statusStream.text).toContain("DuckDB runtime: v1.5.0");
    expect(statusStream.text).toContain("Load check: ok");
  });

  test("reports already-present extensions without reinstalling", async () => {
    const connection = new FakeDuckDbConnection({
      extensions: {
        excel: createFakeExtensionState("/tmp/fake-duckdb/v1.5.0/osx_arm64/excel.duckdb_extension", {
          installed: true,
          loaded: true,
        }),
        sqlite_scanner: createFakeExtensionState(
          "/tmp/fake-duckdb/v1.5.0/osx_arm64/sqlite_scanner.duckdb_extension",
          {
            installed: true,
            loaded: true,
          },
        ),
      },
    });
    const statusStream = createStatusStream();

    const probe = await installDuckDbManagedExtension(
      connection as unknown as DuckDBConnection,
      "sqlite",
      { statusStream: statusStream as unknown as NodeJS.WritableStream },
    );

    expect(probe.installed).toBe(true);
    expect(probe.loadable).toBe(true);
    expect(statusStream.text).toContain("DuckDB extension already present: sqlite");
    expect(statusStream.text).toContain("Load check: ok");
  });

  test("surfaces install failures with a dedicated CLI error", async () => {
    const connection = new FakeDuckDbConnection({
      extensions: {
        excel: createFakeExtensionState("/tmp/fake-duckdb/v1.5.0/osx_arm64/excel.duckdb_extension", {
          installed: false,
          loaded: false,
        }),
        sqlite_scanner: createFakeExtensionState(
          "/tmp/fake-duckdb/v1.5.0/osx_arm64/sqlite_scanner.duckdb_extension",
          {
            installed: false,
            loaded: false,
          },
        ),
      },
      installFailures: {
        sqlite_scanner: "failed to download extension",
      },
    });
    const statusStream = createStatusStream();

    try {
      await installDuckDbManagedExtension(
        connection as unknown as DuckDBConnection,
        "sqlite",
        { statusStream: statusStream as unknown as NodeJS.WritableStream },
      );
      throw new Error("Expected installDuckDbManagedExtension to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.code).toBe("DUCKDB_EXTENSION_INSTALL_FAILED");
      expect(cliError.message).toContain("failed to download extension");
    }
  });

  test("force-reinstalls installed extensions that still fail to load", async () => {
    const connection = new FakeDuckDbConnection({
      extensions: {
        excel: createFakeExtensionState("/opt/custom-duckdb-cache/excel.duckdb_extension", {
          broken: true,
          installed: true,
          loaded: false,
        }),
        sqlite_scanner: createFakeExtensionState(
          "/tmp/fake-duckdb/v1.5.0/osx_arm64/sqlite_scanner.duckdb_extension",
          {
            installed: true,
            loaded: true,
          },
        ),
      },
    });
    const statusStream = createStatusStream();

    const probe = await installDuckDbManagedExtension(
      connection as unknown as DuckDBConnection,
      "excel",
      { statusStream: statusStream as unknown as NodeJS.WritableStream },
    );

    expect(probe.installed).toBe(true);
    expect(probe.loadable).toBe(true);
    expect(probe.cacheFilePath).toBe("/opt/custom-duckdb-cache/excel.duckdb_extension");
    expect(statusStream.text).toContain("Refreshing DuckDB extension: excel");
    expect(statusStream.text).toContain("DuckDB extension already present: excel");
  });
});
