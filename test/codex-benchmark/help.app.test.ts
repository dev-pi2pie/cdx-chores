import { expect, test } from "bun:test";

import { runCli } from "../helpers/cli-test-utils";

test("benchmark help explains shared runs, inheritance, retention and both output modes", () => {
  const result = runCli(["codex-bench", "--help"]);
  expect(result.exitCode).toBe(0);
  const help = result.stdout.replace(/\s+/g, " ");
  expect(help).toContain("Codex model override (repeatable)");
  expect(help).toContain("standard, fast, or ultrafast (repeatable, default: inherit)");
  expect(help).toContain("keep (default), archive, or permanently delete");
  expect(help).toContain("Choose either a model/speed matrix or explicit --case pairs.");
  expect(help).toContain("Omitted Codex settings are inherited.");
  expect(help).toContain("Each combination or case occurrence gets one warm-up");
  expect(help).toContain("Measured trials per combination or case occurrence (default: 3)");
  expect(help).toContain("Repeated pairs share a summary row.");
  expect(help).toContain("codex-bench --case MODEL=fast --case OTHER_MODEL=ultrafast --runs 1");
  expect(help).toContain(
    "codex-bench --codex-model MODEL --codex-speed standard --codex-speed fast",
  );
  expect(help).toContain("--compact Show medians");
  expect(help).toContain("--json Write one JSON report to stdout");
});

test("Interactive help explains its command-local Codex options", () => {
  const result = runCli(["interactive", "--help"]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("Pass Codex options after this command.");
  expect(result.stdout).toContain("Session retention applies to threads this command creates");
  expect(runCli(["--help"]).stdout).not.toContain("--session-retention");
});
