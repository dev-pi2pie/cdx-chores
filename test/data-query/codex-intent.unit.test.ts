import { describe, expect, test } from "bun:test";

import {
  buildDataQueryCodexIntentEditorTemplate,
  normalizeDataQueryCodexEditorIntent,
} from "../../src/cli/data-query/codex";

describe("data query codex intent helpers", () => {
  test("normalizeDataQueryCodexEditorIntent strips comment lines before normalization", () => {
    expect(
      normalizeDataQueryCodexEditorIntent(
        "# Query context\n  # Logical table: file\n\ncount active rows\nby status\n# trailing note",
      ),
    ).toBe("count active rows by status");
  });

  test("buildDataQueryCodexIntentEditorTemplate seeds compact query context", () => {
    const template = buildDataQueryCodexIntentEditorTemplate({
      format: "sqlite",
      introspection: {
        columns: [
          { name: "id", type: "BIGINT" },
          { name: "status", type: "VARCHAR" },
        ],
        sampleRows: [
          { id: "1", status: "active" },
          { id: "2", status: "inactive" },
        ],
        selectedSource: "users",
        truncated: false,
      },
    });

    expect(template).toContain("# Logical table: file");
    expect(template).toContain("# Format: sqlite");
    expect(template).toContain("# Source: users");
    expect(template).toContain("# Schema: id (BIGINT), status (VARCHAR)");
    expect(template).toContain('# 1. {"id":"1","status":"active"}');
    expect(template).toContain(
      "# Write plain intent below. Comment lines starting with # are ignored.",
    );
  });

  test("buildDataQueryCodexIntentEditorTemplate includes the selected range when present", () => {
    const template = buildDataQueryCodexIntentEditorTemplate({
      format: "excel",
      introspection: {
        columns: [
          { name: "id", type: "BIGINT" },
          { name: "name", type: "VARCHAR" },
        ],
        sampleRows: [{ id: "1", name: "Ada" }],
        selectedRange: "A1:B3",
        selectedSource: "Summary",
        truncated: false,
      },
    });

    expect(template).toContain("# Source: Summary");
    expect(template).toContain("# Range: A1:B3");
  });

  test("buildDataQueryCodexIntentEditorTemplate seeds workspace relation context", () => {
    const template = buildDataQueryCodexIntentEditorTemplate({
      format: "sqlite",
      introspection: {
        kind: "workspace",
        relations: [
          {
            alias: "users",
            columns: [{ name: "id", type: "BIGINT" }],
            sampleRows: [{ id: "1" }],
            source: "users",
            truncated: false,
          },
        ],
      },
    });

    expect(template).toContain("# Workspace relations:");
    expect(template).toContain("# - users (source: users)");
  });

  test("buildDataQueryCodexIntentEditorTemplate includes the selected header row when present", () => {
    const template = buildDataQueryCodexIntentEditorTemplate({
      format: "excel",
      introspection: {
        columns: [
          { name: "ID", type: "BIGINT" },
          { name: "status", type: "VARCHAR" },
        ],
        sampleRows: [{ ID: "1001", status: "active" }],
        selectedHeaderRow: 7,
        selectedRange: "B2:E11",
        selectedSource: "Summary",
        truncated: false,
      },
    });

    expect(template).toContain("# Range: B2:E11");
    expect(template).toContain("# Header row: 7");
  });
});
