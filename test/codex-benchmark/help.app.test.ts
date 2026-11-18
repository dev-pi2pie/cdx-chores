import { expect, test } from "bun:test";

import { runCli } from "../helpers/cli-test-utils";

test("benchmark help explains shared runs, inheritance, retention and both output modes", () => {
  const result = runCli(["codex-bench", "--help"]);
  expect(result.exitCode).toBe(0);
  const help = result.stdout.replace(/\s+/g, " ");
  expect(help).toContain("Codex model override (repeatable)");
  expect(help).toContain("standard, fast, or ultrafast (repeatable, default: inherit)");
  expect(help).toContain("keep (default), archive, or permanently delete");
  expect(help).toContain("Use one --runs value for every model and speed combination.");
  expect(help).toContain(
    "Omitted model, provider, reasoning effort, and speed inherit from Codex.",
  );
  expect(help).toContain(
    "codex-bench --codex-model MODEL --codex-speed standard --codex-speed fast",
  );
  expect(help).toContain("codex-bench --prompt-file task.txt --runs 3 --json --show-token-usage");
});

test("Interactive help explains its command-local Codex options", () => {
  const result = runCli(["interactive", "--help"]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("Pass Codex options after this command.");
  expect(result.stdout).toContain("Session retention applies to threads this command creates");
  expect(runCli(["--help"]).stdout).not.toContain("--session-retention");
});
