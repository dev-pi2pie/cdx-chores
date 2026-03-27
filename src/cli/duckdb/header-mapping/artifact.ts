import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { CliError } from "../../errors";
import {
  DATA_HEADER_MAPPING_ARTIFACT_TYPE,
  DATA_HEADER_MAPPING_VERSION,
  type DataHeaderMappingArtifact,
  type DataHeaderMappingEntry,
  type DataHeaderMappingInputReference,
} from "./types";
import {
  ensureKnownQueryInputFormat,
  ensureNonEmptyString,
  isRecord,
  normalizeArtifactPath,
  normalizeHeaderMappingTargetName,
  normalizeOptionalBoolean,
  normalizeOptionalPositiveInteger,
  normalizeOptionalString,
  throwUnsupportedHeaderMappingVersion,
} from "./normalize";

export function normalizeAndValidateAcceptedHeaderMappings(options: {
  availableColumns: readonly string[];
  mappings: readonly DataHeaderMappingEntry[];
}): DataHeaderMappingEntry[] {
  const availableColumns = new Set(options.availableColumns);
  const usedTargets = new Set(
    options.availableColumns.filter(
      (column) => !options.mappings.some((mapping) => mapping.from === column),
    ),
  );
  const seenFrom = new Set<string>();
  const normalizedMappings: DataHeaderMappingEntry[] = [];

  for (const mapping of options.mappings) {
    const from = ensureNonEmptyString(mapping.from, "mappings[].from");
    const normalizedTarget = normalizeHeaderMappingTargetName(
      ensureNonEmptyString(mapping.to, "mappings[].to"),
    );
    if (!normalizedTarget) {
      throw new CliError(
        "Invalid header mapping: mappings[].to must normalize to a non-empty identifier.",
        {
          code: "INVALID_INPUT",
          exitCode: 2,
        },
      );
    }
    if (!availableColumns.has(from)) {
      throw new CliError(`Unknown header mapping source column: ${from}.`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    if (seenFrom.has(from)) {
      throw new CliError(`Duplicate header mapping source column: ${from}.`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    seenFrom.add(from);

    if (normalizedTarget === from) {
      continue;
    }

    if (usedTargets.has(normalizedTarget)) {
      throw new CliError(`Duplicate or colliding header mapping target: ${normalizedTarget}.`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    usedTargets.add(normalizedTarget);

    normalizedMappings.push({
      ...mapping,
      from,
      to: normalizedTarget,
    });
  }

  return normalizedMappings;
}

export function createDataHeaderMappingArtifact(options: {
  input: DataHeaderMappingInputReference;
  mappings: readonly DataHeaderMappingEntry[];
  now: Date;
}): DataHeaderMappingArtifact {
  return {
    input: {
      ...options.input,
    },
    mappings: options.mappings.map((mapping) => ({ ...mapping })),
    metadata: {
      artifactType: DATA_HEADER_MAPPING_ARTIFACT_TYPE,
      issuedAt: options.now.toISOString(),
    },
    version: DATA_HEADER_MAPPING_VERSION,
  };
}

function parseDataHeaderMappingArtifact(
  parsed: unknown,
  options: { rewriting?: boolean } = {},
): DataHeaderMappingArtifact {
  if (!isRecord(parsed)) {
    throw new CliError("Invalid header mapping artifact: expected a JSON object.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const version = parsed.version;
  if (version !== DATA_HEADER_MAPPING_VERSION) {
    throwUnsupportedHeaderMappingVersion(version, options);
  }

  const metadata = parsed.metadata;
  if (!isRecord(metadata)) {
    throw new CliError("Invalid header mapping artifact: metadata must be an object.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const artifactType = ensureNonEmptyString(metadata.artifactType, "metadata.artifactType");
  if (artifactType !== DATA_HEADER_MAPPING_ARTIFACT_TYPE) {
    throw new CliError(
      `Invalid header mapping artifact: metadata.artifactType must be ${DATA_HEADER_MAPPING_ARTIFACT_TYPE}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  const issuedAt = ensureNonEmptyString(metadata.issuedAt, "metadata.issuedAt");

  const input = parsed.input;
  if (!isRecord(input)) {
    throw new CliError("Invalid header mapping artifact: input must be an object.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const normalizedInput: DataHeaderMappingArtifact["input"] = {
    ...input,
    format: ensureKnownQueryInputFormat(input.format, "input.format"),
    path: normalizeArtifactPath(ensureNonEmptyString(input.path, "input.path")),
  };
  const bodyStartRow = normalizeOptionalPositiveInteger(input.bodyStartRow, "input.bodyStartRow");
  const headerRow = normalizeOptionalPositiveInteger(input.headerRow, "input.headerRow");
  const noHeader = normalizeOptionalBoolean(input.noHeader, "input.noHeader");
  const source = normalizeOptionalString(input.source);
  const range = normalizeOptionalString(input.range);
  if (bodyStartRow !== undefined) {
    normalizedInput.bodyStartRow = bodyStartRow;
  }
  if (headerRow !== undefined) {
    normalizedInput.headerRow = headerRow;
  }
  if (noHeader) {
    normalizedInput.noHeader = true;
  }
  if (source) {
    normalizedInput.source = source;
  }
  if (range) {
    normalizedInput.range = range;
  }

  if (!Array.isArray(parsed.mappings)) {
    throw new CliError("Invalid header mapping artifact: mappings must be an array.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const mappings = parsed.mappings.map((mapping, index) => {
    if (!isRecord(mapping)) {
      throw new CliError(`Invalid header mapping artifact: mappings[${index}] must be an object.`, {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }
    return {
      ...mapping,
      from: ensureNonEmptyString(mapping.from, `mappings[${index}].from`),
      ...(typeof mapping.inferredType === "string" && mapping.inferredType.trim().length > 0
        ? { inferredType: mapping.inferredType.trim() }
        : {}),
      ...(typeof mapping.sample === "string" && mapping.sample.trim().length > 0
        ? { sample: mapping.sample }
        : {}),
      to: normalizeHeaderMappingTargetName(
        ensureNonEmptyString(mapping.to, `mappings[${index}].to`),
      ),
    };
  });

  if (mappings.some((mapping) => mapping.to.length === 0)) {
    throw new CliError(
      "Invalid header mapping artifact: mappings[].to must normalize to a non-empty identifier.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return {
    ...parsed,
    input: normalizedInput,
    mappings,
    metadata: {
      ...metadata,
      artifactType,
      issuedAt,
    },
    version: DATA_HEADER_MAPPING_VERSION,
  };
}

export async function readDataHeaderMappingArtifact(
  path: string,
): Promise<DataHeaderMappingArtifact> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to read header mapping artifact: ${path} (${message})`, {
      code: "FILE_READ_ERROR",
      exitCode: 2,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Invalid header mapping artifact JSON: ${path} (${message})`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  return parseDataHeaderMappingArtifact(parsed);
}

function mergeDataHeaderMappingArtifacts(
  existing: DataHeaderMappingArtifact,
  next: DataHeaderMappingArtifact,
): DataHeaderMappingArtifact {
  if (existing.version !== DATA_HEADER_MAPPING_VERSION) {
    throwUnsupportedHeaderMappingVersion(existing.version, { rewriting: true });
  }

  const existingMappingsByFrom = new Map(
    existing.mappings.map((mapping) => [mapping.from, mapping]),
  );

  return {
    ...existing,
    ...next,
    input: {
      ...existing.input,
      ...next.input,
    },
    mappings: next.mappings.map((mapping) => ({
      ...existingMappingsByFrom.get(mapping.from),
      ...mapping,
    })),
    metadata: {
      ...existing.metadata,
      ...next.metadata,
    },
  };
}

export async function writeDataHeaderMappingArtifact(
  path: string,
  artifact: DataHeaderMappingArtifact,
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
      const existingArtifact = await readDataHeaderMappingArtifact(path);
      contentArtifact = mergeDataHeaderMappingArtifacts(existingArtifact, artifact);
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

export function resolveReusableHeaderMappings(options: {
  artifact: DataHeaderMappingArtifact;
  currentInput: DataHeaderMappingInputReference;
}): DataHeaderMappingEntry[] {
  const expected = options.currentInput;
  const actual = options.artifact.input;
  const exactMatch =
    actual.bodyStartRow === expected.bodyStartRow &&
    actual.path === expected.path &&
    actual.format === expected.format &&
    actual.headerRow === expected.headerRow &&
    actual.noHeader === expected.noHeader &&
    actual.source === expected.source &&
    actual.range === expected.range;

  if (!exactMatch) {
    throw new CliError(
      "Header mapping artifact does not match the current input context exactly.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }

  return options.artifact.mappings.map((mapping) => ({ ...mapping }));
}
