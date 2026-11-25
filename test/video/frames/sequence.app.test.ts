import { test } from "bun:test";
import { runExportFixture } from "./fixtures/run-export-fixture";

// Each scenario runs in its own Node process and fixture directory.
test.concurrent.each([
  ["normal", true],
  ["variable", true],
  ["oversized", true],
  ["conflicting-estimate", true],
  ["overwrite", true],
  ["unknown-tail", false],
  ["duplicate", false],
  ["decreasing", false],
  ["missing", false],
  ["sequence-scan-failure", false],
  ["sequence-cancel", false],
  ["serial-overflow", false],
  ["collision", false],
  ["disk-full", false],
] as const)(
  "sequence exporter under Node: %s",
  (mode, completed) => runExportFixture("sequence-driver.ts", mode, completed),
  20_000,
);
