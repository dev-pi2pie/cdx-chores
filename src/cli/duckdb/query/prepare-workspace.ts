import type { DuckDBConnection } from "@duckdb/node-api";

import { CliError } from "../../errors";
import { ensureDuckDbManagedExtensionLoaded } from "../extensions";
import { getDuckDbManagedExtensionNameForFormat, quoteSqlIdentifier } from "./formats";
import { buildRelationSql } from "./prepare-source/sql";
import { listDataQuerySources } from "./source-resolution";
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
    if (normalizedAlias === "file") {
      throw new CliError(
        "The relation alias `file` is reserved in workspace mode. Choose a different alias, such as `f=file`.",
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }

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
  if (format !== "sqlite") {
    throw new CliError("--relation is currently only supported for SQLite query inputs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  validateWorkspaceRelationBindings(relations);

  await ensureDuckDbManagedExtensionLoaded(
    connection,
    getDuckDbManagedExtensionNameForFormat("sqlite"),
    {
      installIfMissing: options.installMissingExtension,
      statusStream: options.statusStream,
    },
  );

  const availableSources = await listDataQuerySources(connection, inputPath, format, {
    ensureExtensionLoaded: false,
  });
  if (!availableSources || availableSources.length === 0) {
    throw new CliError("No queryable SQLite sources were found.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  for (const relation of relations) {
    if (!availableSources.includes(relation.source)) {
      throw new CliError(
        `Unknown SQLite source for --relation ${relation.alias}=${relation.source}. Available sources: ${formatAvailableSources(availableSources)}.`,
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }

    await connection.run(
      `create or replace temp view ${quoteSqlIdentifier(relation.alias)} as ${buildRelationSql(
        inputPath,
        format,
        {
          source: relation.source,
        },
      )}`,
    );
  }

  return {
    mode: "workspace",
    relationAliases: relations.map((relation) => relation.alias),
  };
}
