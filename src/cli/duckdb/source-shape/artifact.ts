import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { CliError } from "../../errors";
import {
  DATA_SOURCE_SHAPE_ARTIFACT_TYPE,
  DATA_SOURCE_SHAPE_VERSION,
  type DataSourceShapeArtifact,
  type DataSourceShapeInputReference,
  type DataSourceShapeSelection,
} from "./types";
import {
  ensureKnownSourceShapeInputFormat,
  ensureNonEmptyString,
  isRecord,
  normalizeArtifactPath,
  normalizeOptionalPositiveInteger,
  throwUnsupportedSourceShapeVersion,
} from "./normalize";
import { normalizeExcelBodyStartRow, normalizeExcelHeaderRow, normalizeExcelRange } from "../query";

function isValidReviewedSourceShape(shape: DataSourceShapeSelection): boolean {
  return Boolean(shape.range) || shape.headerRow !== undefined || shape.bodyStartRow !== undefined;
}

export function createDataSourceShapeArtifact(options: {
  input: DataSourceShapeInputReference;
  now: Date;
  shape: DataSourceShapeSelection;
}): DataSourceShapeArtifact {
  if (!isValidReviewedSourceShape(options.shape)) {
    throw new CliError(
      "Invalid source shape artifact: shape must include range, headerRow, bodyStartRow, or a valid combination of them.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return {
    input: {
      ...options.input,
    },
    metadata: {
      artifactType: DATA_SOURCE_SHAPE_ARTIFACT_TYPE,
      issuedAt: options.now.toISOString(),
    },
    shape: {
      ...(options.shape.bodyStartRow !== undefined
        ? { bodyStartRow: normalizeExcelBodyStartRow(options.shape.bodyStartRow) }
        : {}),
      ...(options.shape.range ? { range: normalizeExcelRange(options.shape.range) } : {}),
      ...(options.shape.headerRow !== undefined
        ? { headerRow: normalizeExcelHeaderRow(options.shape.headerRow) }
        : {}),
    },
    version: DATA_SOURCE_SHAPE_VERSION,
  };
}

function parseDataSourceShapeArtifact(
  parsed: unknown,
  options: { rewriting?: boolean } = {},
): DataSourceShapeArtifact {
  if (!isRecord(parsed)) {
    throw new CliError("Invalid source shape artifact: expected a JSON object.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const version = parsed.version;
  if (version !== DATA_SOURCE_SHAPE_VERSION) {
    throwUnsupportedSourceShapeVersion(version, options);
  }

  const metadata = parsed.metadata;
  if (!isRecord(metadata)) {
    throw new CliError("Invalid source shape artifact: metadata must be an object.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const artifactType = ensureNonEmptyString(metadata.artifactType, "metadata.artifactType");
  if (artifactType !== DATA_SOURCE_SHAPE_ARTIFACT_TYPE) {
    throw new CliError(
      `Invalid source shape artifact: metadata.artifactType must be ${DATA_SOURCE_SHAPE_ARTIFACT_TYPE}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  const issuedAt = ensureNonEmptyString(metadata.issuedAt, "metadata.issuedAt");

  const input = parsed.input;
  if (!isRecord(input)) {
    throw new CliError("Invalid source shape artifact: input must be an object.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  const normalizedInput: DataSourceShapeArtifact["input"] = {
    ...input,
    format: ensureKnownSourceShapeInputFormat(input.format, "input.format"),
    path: normalizeArtifactPath(ensureNonEmptyString(input.path, "input.path")),
    source: ensureNonEmptyString(input.source, "input.source"),
  };

  const shape = parsed.shape;
  if (!isRecord(shape)) {
    throw new CliError("Invalid source shape artifact: shape must be an object.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const normalizedBodyStartRow = normalizeOptionalPositiveInteger(
    shape.bodyStartRow,
    "shape.bodyStartRow",
  );
  const normalizedHeaderRow = normalizeOptionalPositiveInteger(shape.headerRow, "shape.headerRow");
  const normalizedShape: DataSourceShapeArtifact["shape"] = {
    ...shape,
    ...(normalizedBodyStartRow !== undefined
      ? { bodyStartRow: normalizeExcelBodyStartRow(normalizedBodyStartRow) }
      : {}),
    ...(typeof shape.range === "string" && shape.range.trim().length > 0
      ? { range: normalizeExcelRange(shape.range) }
      : {}),
    ...(normalizedHeaderRow !== undefined ? { headerRow: normalizedHeaderRow } : {}),
  };
  if (!isValidReviewedSourceShape(normalizedShape)) {
    throw new CliError(
      "Invalid source shape artifact: shape must include range, headerRow, bodyStartRow, or a valid combination of them.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return {
    ...parsed,
    input: normalizedInput,
    metadata: {
      ...metadata,
      artifactType,
      issuedAt,
    },
    shape: normalizedShape,
    version: DATA_SOURCE_SHAPE_VERSION,
  };
}

export async function readDataSourceShapeArtifact(path: string): Promise<DataSourceShapeArtifact> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to read source shape artifact: ${path} (${message})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Invalid source shape artifact JSON: ${path} (${message})`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return parseDataSourceShapeArtifact(parsed);
}

function mergeDataSourceShapeArtifacts(
  existing: DataSourceShapeArtifact,
  next: DataSourceShapeArtifact,
): DataSourceShapeArtifact {
  if (existing.version !== DATA_SOURCE_SHAPE_VERSION) {
    throwUnsupportedSourceShapeVersion(existing.version, { rewriting: true });
  }

  return {
    ...existing,
    ...next,
    input: {
      ...existing.input,
      ...next.input,
    },
    metadata: {
      ...existing.metadata,
      ...next.metadata,
    },
    shape: {
      ...existing.shape,
      ...next.shape,
    },
  };
}

export async function writeDataSourceShapeArtifact(
  path: string,
  artifact: DataSourceShapeArtifact,
  options: { overwrite?: boolean } = {},
): Promise<void> {
  const overwrite = options.overwrite ?? false;
  let contentArtifact = artifact;

  try {
    await stat(path);
    if (!overwrite) {
      throw new CliError(`Output file already exists: ${path}. Use --overwrite to replace it.`, {
        code: "OUTPUT_EXISTS",
        exitCode: 2,
      });
    }
    try {
      const existingArtifact = await readDataSourceShapeArtifact(path);
      contentArtifact = mergeDataSourceShapeArtifacts(existingArtifact, artifact);
    } catch (error) {
      if (error instanceof CliError && error.code === "INVALID_INPUT") {
        contentArtifact = artifact;
      } else {
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    // ignore missing file
  }

  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, `${JSON.stringify(contentArtifact, null, 2)}\n`, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to write file: ${path} (${message})`, {
      code: "FILE_WRITE_ERROR",
      exitCode: 2,
    });
  }
}

export function resolveReusableSourceShape(options: {
  artifact: DataSourceShapeArtifact;
  currentInput: {
    format: "excel";
    path: string;
    source?: string;
  };
}): DataSourceShapeSelection & { source: string } {
  const actual = options.artifact.input;
  const expected = options.currentInput;
  const exactMatch =
    actual.path === expected.path &&
    actual.format === expected.format &&
    (expected.source === undefined || actual.source === expected.source);

  if (!exactMatch) {
    throw new CliError("Source shape artifact does not match the current input context exactly.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return {
    ...(options.artifact.shape.bodyStartRow !== undefined
      ? { bodyStartRow: options.artifact.shape.bodyStartRow }
      : {}),
    ...(options.artifact.shape.range ? { range: options.artifact.shape.range } : {}),
    ...(options.artifact.shape.headerRow !== undefined
      ? { headerRow: options.artifact.shape.headerRow }
      : {}),
    source: actual.source,
  };
}
