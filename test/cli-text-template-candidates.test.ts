import { describe, expect, test } from "bun:test";

import { resolveTemplateCompletionMatch } from "../src/cli/prompts/text-template-candidates";

describe("text template candidates", () => {
  test("does not activate before an opening brace is typed", () => {
    expect(resolveTemplateCompletionMatch("timestamp")).toBeUndefined();
    expect(resolveTemplateCompletionMatch("report-date")).toBeUndefined();
  });

  test("matches root-level candidates for a broad token prefix", () => {
    expect(resolveTemplateCompletionMatch("{t")).toEqual({
      candidates: ["{timestamp}"],
      fragment: "{t",
      fragmentStart: 0,
      scope: "root",
      scopeKey: "root:{t",
    });
  });

  test("narrows into the timestamp family after the family prefix is typed", () => {
    expect(resolveTemplateCompletionMatch("{timestamp_")).toEqual({
      candidates: [
        "{timestamp_local}",
        "{timestamp_utc}",
        "{timestamp_local_iso}",
        "{timestamp_utc_iso}",
        "{timestamp_local_12h}",
        "{timestamp_utc_12h}",
      ],
      fragment: "{timestamp_",
      fragmentStart: 0,
      scope: "timestamp",
      scopeKey: "timestamp:{timestamp_",
    });
  });

  test("narrows into the date family after the family prefix is typed", () => {
    expect(resolveTemplateCompletionMatch("{date_")).toEqual({
      candidates: ["{date_local}", "{date_utc}"],
      fragment: "{date_",
      fragmentStart: 0,
      scope: "date",
      scopeKey: "date:{date_",
    });
  });
});
