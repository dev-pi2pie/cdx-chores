import { describe, expect, test } from "bun:test";

import {
  collectDataQueryRelationBindingOption,
  parseDataQueryRelationBindingOptionValue,
  parseDataQueryRelationBindingOptionValues,
} from "../src/cli/options/parsers";

describe("cli option parsers", () => {
  test("parses one --relation binding value", () => {
    expect(parseDataQueryRelationBindingOptionValue("events=analytics.events")).toEqual({
      alias: "events",
      source: "analytics.events",
    });
  });

  test("parses comma-separated --relation bundles", () => {
    expect(parseDataQueryRelationBindingOptionValues("users, events=analytics.events")).toEqual([
      { alias: "users", source: "users" },
      { alias: "events", source: "analytics.events" },
    ]);
  });

  test("collects comma-separated --relation bundles across repeated flags", () => {
    expect(
      collectDataQueryRelationBindingOption("users,events=analytics.events", [
        { alias: "file", source: "file" },
      ]),
    ).toEqual([
      { alias: "file", source: "file" },
      { alias: "users", source: "users" },
      { alias: "events", source: "analytics.events" },
    ]);
  });

  test("rejects empty entries inside comma-separated --relation bundles", () => {
    expect(() => parseDataQueryRelationBindingOptionValues("users,,events")).toThrow(
      "--relation bundle cannot contain empty bindings",
    );
  });

  test("rejects malformed aliases inside comma-separated --relation bundles", () => {
    expect(() => parseDataQueryRelationBindingOptionValues("users,1events=analytics.events")).toThrow(
      "--relation alias must be a simple SQL identifier",
    );
  });
});
