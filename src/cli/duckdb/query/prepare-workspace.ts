import type { DuckDBConnection } from "@duckdb/node-api";

import { CliError } from "../../errors";
import { ensureDuckDbManagedExtensionLoaded } from "../extensions";
import { buildDuckDbFileRelationSql, listDuckDbFileSourceEntries } from "./duckdb-file";
import {
  getDuckDbManagedExtensionNameForFormat,
  getMultiObjectSourceDisplayLabel,
  quoteSqlIdentifier,
} from "./formats";
import { buildRelationSql } from "./prepare-source/sql";
import {
  listDataQuerySources,
  resolveAvailableDataQuerySourceName,
  resolveDuckDbFileSource,
} from "./source-resolution";
import type {
  DataQueryInputFormat,
  DataQueryRelationBinding,
  PreparedDataQueryContext,
} from "./types";

function formatAvailableSources(sources: readonly string[]): string {
  return sources.join(", ");
}

function validateWorkspaceRelationBindings(relations: readonly DataQueryRelationBinding[]): void {
  if (relations.length === 0) {
    throw new CliError("Workspace mode requires at least one --relation binding.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const seenAliases = new Set<string>();
  for (const relation of relations) {
    const normalizedAlias = relation.alias.trim().toLowerCase();
    if (seenAliases.has(normalizedAlias)) {
      throw new CliError(`Duplicate workspace relation alias: ${relation.alias}.`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    seenAliases.add(normalizedAlias);
  }
}

export async function prepareDataQueryWorkspace(
  connection: DuckDBConnection,
  inputPath: string,
  format: DataQueryInputFormat,
  relations: readonly DataQueryRelationBinding[],
  options: {
    installMissingExtension?: boolean;
    statusStream?: NodeJS.WritableStream;
  } = {},
): Promise<PreparedDataQueryContext> {
  if (format !== "sqlite" && format !== "duckdb") {
    throw new CliError(
      "--relation is currently only supported for SQLite and DuckDB query inputs.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  validateWorkspaceRelationBindings(relations);

  if (format === "sqlite") {
    await ensureDuckDbManagedExtensionLoaded(
      connection,
      getDuckDbManagedExtensionNameForFormat("sqlite"),
      {
        installIfMissing: options.installMissingExtension,
        statusStream: options.statusStream,
      },
    );
  }

  const availableDuckDbEntries =
    format === "duckdb" ? await listDuckDbFileSourceEntries(connection, inputPath) : [];
  const availableSources =
    format === "duckdb"
      ? availableDuckDbEntries.map((entry) => entry.selector)
      : await listDataQuerySources(connection, inputPath, format, {
          ensureExtensionLoaded: false,
        });
  if (!availableSources || availableSources.length === 0) {
    throw new CliError(
      `No queryable ${getMultiObjectSourceDisplayLabel(format)} sources were found.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  for (const relation of relations) {
    const resolvedSource = resolveAvailableDataQuerySourceName(relation.source, availableSources);
    if (!resolvedSource) {
      throw new CliError(
        `Unknown ${getMultiObjectSourceDisplayLabel(format)} source for --relation ${relation.alias}=${relation.source}. Available sources: ${formatAvailableSources(availableSources)}.`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }

    await connection.run(
      `create or replace temp view ${quoteSqlIdentifier(relation.alias)} as ${
        format === "duckdb"
          ? buildDuckDbFileRelationSql(
              await resolveDuckDbFileSource(connection, inputPath, resolvedSource, {
                entries: availableDuckDbEntries,
              }),
            )
          : buildRelationSql(inputPath, format, {
              source: resolvedSource,
            })
      }`,
    );
  }

  return {
    mode: "workspace",
    relationAliases: relations.map((relation) => relation.alias),
  };
}
