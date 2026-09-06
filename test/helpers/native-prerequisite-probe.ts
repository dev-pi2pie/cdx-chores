import { probeDuckDbManagedExtension } from "../../src/cli/duckdb/extensions";

// Explicit child entry point: native initialization may block the event loop.
// LOAD reads the existing runtime cache; this probe never installs extensions.
const readiness = { duckdb: false, excel: false, sqlite: false };
try {
  const { DuckDBConnection } = await import("@duckdb/node-api");
  const connection = await DuckDBConnection.create();
  try {
    await connection.run("SET autoinstall_known_extensions = false");
    await connection.run("SET autoload_known_extensions = false");
    readiness.duckdb = true;
    readiness.excel = (await probeDuckDbManagedExtension(connection, "excel")).loadable;
    readiness.sqlite = (await probeDuckDbManagedExtension(connection, "sqlite")).loadable;
  } finally {
    connection.closeSync();
  }
} catch {
  // Do not return native errors containing host cache paths or configuration.
}
process.stdout.write(JSON.stringify(readiness));
