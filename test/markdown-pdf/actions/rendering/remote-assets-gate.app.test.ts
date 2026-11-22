import { expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { actionMdToPdf } from "../../../../src/cli/actions";
import { createActionTestRuntime, expectCliError } from "../../../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../../../helpers/cli-test-utils";
import { createPdfRunner } from "./render-support";

async function withRenderCase(
  version: string,
  testCase: (
    run: (allowRemoteAssets?: boolean) => Promise<void>,
    fixture: ReturnType<typeof createPdfRunner>,
    paths: { dir: string; pdf: string; html: string },
  ) => Promise<void>,
  weasyprintHelp?: string,
) {
  await withTempFixtureDir("md-pdf-remote-assets-gate", async (dir) => {
    const input = join(dir, "report.md");
    const pdf = join(dir, "report.pdf");
    const html = join(dir, "report.html");
    await writeFile(input, "# Report\n");
    const fixture = createPdfRunner({
      html: "<p>Report</p>",
      weasyprintVersion: version,
      weasyprintHelp,
    });
    const { runtime } = createActionTestRuntime();
    const run = async (allowRemoteAssets?: boolean) =>
      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(input),
        output: toRepoRelativePath(pdf),
        htmlOutput: toRepoRelativePath(html),
        allowRemoteAssets,
        runner: fixture.runner,
      });
    await testCase(run, fixture, { dir, pdf, html });
  });
}

test.each(["70.0", "71.2.1"])("restricts asset protocols on WeasyPrint %s", async (version) => {
  await withRenderCase(version, async (run, { calls }, { dir, pdf }) => {
    await run();
    const rendererCalls = calls.filter(({ command }) => command === "weasyprint");
    expect(rendererCalls.map(({ cwd }) => cwd)).toEqual([dir, dir, dir]);
    expect(rendererCalls[0]?.args).toEqual(["--info"]);
    expect(rendererCalls[1]?.args).toEqual(["--help"]);
    expect(rendererCalls[2]?.args.slice(0, 4)).toEqual([
      "--base-url",
      dir,
      "--allowed-protocols",
      "file,data",
    ]);
    expect(await readFile(pdf, "utf8")).toStartWith("%PDF");
  });
});

test.each([
  ["69.0", "DEPENDENCY_VERSION_UNSUPPORTED"],
  ["70.0rc1", "DEPENDENCY_VERSION_UNKNOWN"],
  ["custom-build", "DEPENDENCY_VERSION_UNKNOWN"],
] as const)("rejects unverified asset enforcement on WeasyPrint %s", async (version, code) => {
  await withRenderCase(version, async (run, { calls }, { pdf, html }) => {
    await expectCliError(run, { code, exitCode: 2, messageIncludes: "70.0" });
    expect(calls.map(({ args }) => args)).toEqual([["--version"], ["--info"]]);
    await expect(readFile(pdf)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(html)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

test("fails before output when the renderer lacks the protocol option", async () => {
  await withRenderCase(
    "71.0",
    async (run, { calls }, { pdf, html }) => {
      await expectCliError(run, {
        code: "MARKDOWN_PDF_ASSET_POLICY_UNSUPPORTED",
        exitCode: 2,
        messageIncludes: "--allowed-protocols",
      });
      expect(
        calls.filter(({ command }) => command === "weasyprint").map(({ args }) => args),
      ).toEqual([["--info"], ["--help"]]);
      await expect(readFile(pdf)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(readFile(html)).rejects.toMatchObject({ code: "ENOENT" });
    },
    "  --allowed-protocols-preview VALUE",
  );
});

test("explicit opt-in keeps the older renderer path", async () => {
  await withRenderCase("65.1", async (run, { calls }, { pdf }) => {
    await run(true);
    const rendererCalls = calls.filter(({ command }) => command === "weasyprint");
    expect(rendererCalls.map(({ args }) => args[0])).toEqual(["--info", "--base-url"]);
    expect(rendererCalls[1]?.args).not.toContain("--allowed-protocols");
    expect(await readFile(pdf, "utf8")).toStartWith("%PDF");
  });
});
