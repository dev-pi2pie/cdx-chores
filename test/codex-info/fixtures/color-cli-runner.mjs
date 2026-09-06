// Isolated runner for real CLI color policy and built-package smoke checks.
const { runCli } = await import(
  process.env.CDX_CHORES_COLOR_TEST_CLI_MODULE ?? "../../../src/command.ts"
);
const results = [];
for (const view of ["summary", "models", "providers"]) {
  for (const format of ["default", "details", "json"]) {
    let stdout = "";
    let stderr = "";
    const command = [
      "node",
      "cdx-chores",
      "codex-info",
      ...(view === "summary" ? [] : [view]),
      ...(format === "default" ? [] : ["--" + format]),
      ...(process.env.CASE_FLAG === "1" ? ["--no-color"] : []),
    ];
    await runCli(command, {
      cwd: process.cwd(),
      stdout: {
        isTTY: true,
        write(text) {
          stdout += text;
          return true;
        },
      },
      stderr: {
        isTTY: false,
        write(text) {
          stderr += text;
          return true;
        },
      },
    });
    results.push({ view, format, stdout, stderr });
  }
}
console.log(JSON.stringify(results));
