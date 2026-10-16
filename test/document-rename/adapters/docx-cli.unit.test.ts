import { expect, test } from "bun:test";

import { parseCandidateCli } from "../../../scripts/docx-candidate/cli.mjs";

test("candidate comparison defaults to full scope and retains only explicit smoke runs", () => {
  expect(parseCandidateCli("comparison", [])).toEqual({
    action: "run",
    smoke: false,
    keepArtifacts: false,
  });
  expect(parseCandidateCli("comparison", ["--smoke"])).toEqual({
    action: "run",
    smoke: true,
    keepArtifacts: false,
  });
  for (const args of [
    ["--smoke", "--keep-artifacts"],
    ["--keep-artifacts", "--smoke"],
  ])
    expect(parseCandidateCli("comparison", args)).toEqual({
      action: "run",
      smoke: true,
      keepArtifacts: true,
    });
  expect(parseCandidateCli("measurement", [])).toEqual({ action: "run" });
  expect(parseCandidateCli("package", [])).toEqual({ action: "run" });
});

test("both help aliases provide essential usage and options as plain text", () => {
  for (const [kind, script, scope] of [
    ["comparison", "launch.mjs", "full corpus by default"],
    ["measurement", "measure-launch.mjs", "18 workloads"],
    ["package", "package-check.mjs", "eight fresh npm/Bun consumer paths"],
  ] as const) {
    const long = parseCandidateCli(kind, ["--help"]);
    expect(long.action).toBe("help");
    if (long.action !== "help") throw new Error("Expected command help");
    expect(parseCandidateCli(kind, ["-h"])).toEqual(long);
    expect(long.text).toContain(`node ./scripts/docx-candidate/${script}`);
    expect(long.text).toContain(scope);
    expect(long.text).toContain("-h, --help");
    expect(long.text).not.toContain("\u001b");
  }
  const comparison = parseCandidateCli("comparison", ["--help"]);
  const measurement = parseCandidateCli("measurement", ["--help"]);
  const packageHelp = parseCandidateCli("package", ["--help"]);
  if (
    comparison.action !== "help" ||
    measurement.action !== "help" ||
    packageHelp.action !== "help"
  )
    throw new Error("Expected command help");
  expect(comparison.text).toContain("examples/playground/docx-candidate/smoke/<run-id>/");
  expect(measurement.text).toContain("POSIX");
  expect(packageHelp.text).toContain("registry access");
});

test("invalid combinations fail with actionable usage rather than starting work", () => {
  for (const [args, reason] of [
    [["--keep-artifacts"], "--keep-artifacts requires --smoke"],
    [["--smoke", "--smoke"], "only once"],
    [["--keep-artifacts", "--smoke", "--keep-artifacts"], "only once"],
    [["--unknown"], "Unknown option"],
    [["input.docx"], "positional argument"],
    [["--smoke=yes"], "Unknown option"],
    [["--help", "--smoke"], "alone"],
    [["--help", "-h"], "alone"],
  ] as const) {
    const result = parseCandidateCli("comparison", [...args]);
    expect(result.action).toBe("error");
    if (result.action !== "error") throw new Error("Expected argument error");
    expect(result.text).toContain(reason);
    expect(result.text).toContain("Usage:");
  }
  for (const kind of ["measurement", "package"] as const)
    for (const args of [["--smoke"], ["--keep-artifacts"], ["file"], ["--help", "--unknown"]]) {
      const result = parseCandidateCli(kind, args);
      expect(result.action).toBe("error");
      if (result.action !== "error") throw new Error("Expected argument error");
      expect(result.text).toContain("Usage:");
    }
});

test("argument diagnostics do not echo arbitrary terminal control sequences", () => {
  const result = parseCandidateCli("comparison", ["\u001b[31mprivate-path"]);
  expect(result.action).toBe("error");
  if (result.action !== "error") throw new Error("Expected argument error");
  expect(result.text).not.toContain("\u001b");
  expect(result.text).not.toContain("private-path");
});
