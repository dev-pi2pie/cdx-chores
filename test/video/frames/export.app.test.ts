import { test } from "bun:test";
import { runExportFixture } from "./fixtures/run-export-fixture";

// Each scenario runs in its own Node process and fixture directory.
test.concurrent.each([
  ["normal", true],
  ["repeat", true],
  ["unavailable", false],
  ["late-alpha", false],
  ["webp-zero", false],
  ["decoder-partial", false],
  ["short-encoder", false],
  ["encoder-failure", false],
  ["source-changed", false],
  ["cancel", false],
  ["finish-cancel", false],
  ["settlement-cancel", false],
  ["duplicate", false],
  ["duplicate-overwrite", false],
  ["duplicate-case", false],
  ["duplicate-unicode", false],
] as const)(
  "image export under Node: %s",
  (mode, completed) => runExportFixture("export-driver.ts", mode, completed),
  20_000,
);
