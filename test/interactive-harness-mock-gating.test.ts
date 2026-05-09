import { describe, expect, test } from "bun:test";

import { createHarnessRunnerContext } from "./helpers/interactive-harness/context";
import { needsDataQueryMocks } from "./helpers/interactive-harness/mocks";

describe("interactive harness mock gating", () => {
  test("does not install data-query mocks for unrelated data actions", () => {
    expect(
      needsDataQueryMocks(
        createHarnessRunnerContext({
          mode: "run",
          selectQueue: ["data", "data:preview"],
        }),
      ),
    ).toBe(false);
  });

  test("installs data-query mocks for query, extract, and explicit data-query scenarios", () => {
    expect(
      needsDataQueryMocks(
        createHarnessRunnerContext({
          mode: "run",
          selectQueue: ["data", "data:query"],
        }),
      ),
    ).toBe(true);
    expect(
      needsDataQueryMocks(
        createHarnessRunnerContext({
          mode: "run",
          selectQueue: ["data", "data:extract"],
        }),
      ),
    ).toBe(true);
    expect(
      needsDataQueryMocks(
        createHarnessRunnerContext({
          mode: "run",
          selectQueue: ["data", "data:preview"],
          dataQueryDetectedFormat: "csv",
        }),
      ),
    ).toBe(true);
  });
});
