import { expect, test } from "bun:test";

import { formatBenchmarkReportPath } from "../../src/cli/codex-bench/paths";

test.each([
  ["/home/fixture", "~"],
  ["/home/fixture/.codex", "~/.codex"],
  ["/home/fixture/..notes/task.txt", "~/..notes/task.txt"],
  ["/home/fixture-other/.codex", "/home/fixture-other/.codex"],
  ["/tmp/custom-codex", "/tmp/custom-codex"],
  ["task.txt", "task.txt"],
  [null, null],
])("formats Unix report path %s by component", (input, output) => {
  const runtime = { cwd: "/work", platform: "darwin", displayPathStyle: "relative" } as const;
  expect(formatBenchmarkReportPath(runtime, input, "/home/fixture")).toBe(output);
});

test.each([
  ["C:\\Users\\Fixture", "%USERPROFILE%"],
  ["c:\\users\\fixture\\.codex", "%USERPROFILE%\\.codex"],
  ["C:\\Users\\Fixture.Other\\.codex", "C:\\Users\\Fixture.Other\\.codex"],
  ["D:\\custom-codex", "D:\\custom-codex"],
  ["\\\\server\\share\\codex", "\\\\server\\share\\codex"],
  ["task.txt", "task.txt"],
])("formats Windows report path %s by component", (input, output) => {
  const runtime = { cwd: "C:\\Work", platform: "win32", displayPathStyle: "relative" } as const;
  expect(formatBenchmarkReportPath(runtime, input, "C:\\Users\\Fixture")).toBe(output);
});

test("absolute mode resolves a relative prompt using the invocation path flavor", () => {
  expect(
    formatBenchmarkReportPath(
      { cwd: "/work", platform: "linux", displayPathStyle: "absolute" },
      "task.txt",
      "/home/fixture",
    ),
  ).toBe("/work/task.txt");
  expect(
    formatBenchmarkReportPath(
      { cwd: "C:\\Work", platform: "win32", displayPathStyle: "absolute" },
      "task.txt",
      "C:\\Users\\Fixture",
    ),
  ).toBe("C:\\Work\\task.txt");
});
