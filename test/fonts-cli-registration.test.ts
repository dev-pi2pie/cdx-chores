import { describe, expect, test } from "bun:test";

import { runCli } from "./helpers/cli-test-utils";

describe("font CLI registration", () => {
  test("registers the top-level font command", () => {
    const result = runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("font");
    expect(result.stdout).toContain("Font discovery utilities");
  });

  test("registers font list options through the command layer", () => {
    const help = runCli(["font", "list", "--help"]);
    const invalidLimit = runCli(["font", "list", "--limit", "0"]);

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("Usage: cdx-chores font list [options]");
    expect(help.stdout).toContain("--json");
    expect(help.stdout).toContain("--debug");
    expect(help.stdout).toContain("--discovery <mode>");
    expect(help.stdout).toContain("--family <name>");
    expect(help.stdout).toContain("--limit <n>");
    expect(invalidLimit.exitCode).toBe(1);
    expect(invalidLimit.stderr).toContain("--limit must be a positive integer");
  });

  test("registers font inspect options through the command layer", () => {
    const help = runCli(["font", "inspect", "--help"]);

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("Usage: cdx-chores font inspect [options]");
    expect(help.stdout).toContain("--json");
    expect(help.stdout).toContain("--debug");
    expect(help.stdout).toContain("--discovery <mode>");
    expect(help.stdout).toContain("--family <name>");
  });

  test("registers font check options through the command layer", () => {
    const help = runCli(["font", "check", "--help"]);
    const invalidRequire = runCli([
      "font",
      "check",
      "--family",
      "Latin",
      "--text",
      "A",
      "--require",
      "bogus",
    ]);
    const invalidDiscovery = runCli([
      "font",
      "check",
      "--family",
      "Latin",
      "--text",
      "A",
      "--discovery",
      "bogus",
    ]);

    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("Usage: cdx-chores font check [options]");
    expect(help.stdout).toContain("--json");
    expect(help.stdout).toContain("--debug");
    expect(help.stdout).toContain("--discovery <mode>");
    expect(help.stdout).toContain("--family <name>");
    expect(help.stdout).toContain("--text <value>");
    expect(help.stdout).toContain("--text-file <path>");
    expect(help.stdout).toContain("--require <kind>");
    expect(invalidRequire.exitCode).toBe(2);
    expect(invalidRequire.stderr).toContain("--require must be one of: nerd");
    expect(invalidDiscovery.exitCode).toBe(2);
    expect(invalidDiscovery.stderr).toContain(
      "--discovery must be one of: auto, native, fontconfig",
    );
  });

  test("rejects invalid font discovery modes through the command layer", () => {
    const result = runCli(["font", "list", "--discovery", "bogus"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--discovery must be one of: auto, native, fontconfig");
  });

  test("rejects invalid font inspect discovery modes through the command layer", () => {
    const result = runCli(["font", "inspect", "--family", "Noto", "--discovery", "bogus"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--discovery must be one of: auto, native, fontconfig");
  });
});
