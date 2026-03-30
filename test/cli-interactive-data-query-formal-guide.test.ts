import { describe, expect, test } from "bun:test";

import {
  buildFormalGuideSql,
  getFormalGuideFilterOperatorChoices,
} from "../src/cli/interactive/data-query/sql/formal-guide";

describe("interactive data query formal-guide helpers", () => {
  test("returns text-oriented filter choices for text columns", () => {
    expect(getFormalGuideFilterOperatorChoices("VARCHAR")).toEqual([
      { name: "=", value: "=", requiresValue: true },
      { name: "!=", value: "!=", requiresValue: true },
      { name: "contains", value: "contains", requiresValue: true },
      { name: "starts with", value: "starts-with", requiresValue: true },
      { name: "ends with", value: "ends-with", requiresValue: true },
      { name: "is empty", value: "is-empty", requiresValue: false },
      { name: "is not empty", value: "is-not-empty", requiresValue: false },
      { name: "is null", value: "is-null", requiresValue: false },
      { name: "is not null", value: "is-not-null", requiresValue: false },
    ]);
  });

  test("returns boolean-specific filter choices for boolean columns", () => {
    expect(getFormalGuideFilterOperatorChoices("BOOLEAN")).toEqual([
      { name: "is true", value: "is-true", requiresValue: false },
      { name: "is false", value: "is-false", requiresValue: false },
      { name: "is null", value: "is-null", requiresValue: false },
      { name: "is not null", value: "is-not-null", requiresValue: false },
    ]);
  });

  test("adds sql limit after order by when present", () => {
    expect(
      buildFormalGuideSql({
        aggregateKind: "none",
        filters: [],
        groupByColumns: [],
        limit: 25,
        orderBySpecs: [{ column: "name", direction: "asc" }],
        selectAllColumns: false,
        selectedColumns: ["id", "name"],
      }),
    ).toBe('select "id", "name"\nfrom file\norder by "name" asc\nlimit 25');
  });

  test("renders new special filter operators deterministically", () => {
    expect(
      buildFormalGuideSql({
        aggregateKind: "none",
        filters: [
          { column: "name", operator: "starts-with", value: "Ad" },
          { column: "name", operator: "ends-with", value: "da" },
          { column: "notes", operator: "is-empty" },
          { column: "deleted_at", operator: "is-null" },
          { column: "is_pro", operator: "is-true" },
        ],
        groupByColumns: [],
        orderBySpecs: [],
        selectAllColumns: true,
        selectedColumns: [],
      }),
    ).toBe(`select *
from file
where lower(cast("name" as varchar)) like lower('Ad') || '%' and lower(cast("name" as varchar)) like '%' || lower('da') and cast("notes" as varchar) = '' and "deleted_at" is null and "is_pro" is true`);
  });
});
