import { describe, expect, test } from "bun:test";

import {
  formatDataStackCodexAssistSignal,
  getDataStackCodexAssistSignals,
} from "../src/cli/data-stack/codex-signals";
import { computeDataStackDiagnostics } from "../src/cli/data-stack/diagnostics";

describe("data stack Codex assist signals", () => {
  test("detects candidate unique keys from deterministic diagnostics", () => {
    const diagnostics = computeDataStackDiagnostics({
      header: ["id", "status"],
      matchedFileCount: 1,
      rows: [
        ["1", "active"],
        ["2", "paused"],
      ],
    });

    expect(
      getDataStackCodexAssistSignals({
        diagnostics,
        headerMode: "header",
        inputColumns: ["id", "status"],
        schemaMode: "strict",
        uniqueBy: [],
      }),
    ).toEqual(["candidate-unique-keys"]);
  });

  test("keeps no-signal inputs quiet", () => {
    const diagnostics = computeDataStackDiagnostics({
      header: ["a", "b", "c"],
      matchedFileCount: 2,
      rows: [
        ["0", "0", "0"],
        ["0", "0", "1"],
        ["0", "1", "0"],
        ["0", "1", "1"],
        ["1", "0", "0"],
        ["1", "0", "1"],
        ["1", "1", "0"],
        ["1", "1", "1"],
      ],
    });

    expect(
      getDataStackCodexAssistSignals({
        diagnostics,
        headerMode: "header",
        inputColumns: ["a", "b", "c"],
        schemaMode: "strict",
        uniqueBy: [],
      }),
    ).toEqual([]);
  });

  test("formats signal labels for interactive copy", () => {
    expect(formatDataStackCodexAssistSignal("union-by-name-gaps")).toBe("union-by-name gaps");
  });
});
