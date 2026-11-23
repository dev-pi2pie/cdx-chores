import assert from "node:assert/strict";
import * as prompts from "@inquirer/prompts";
import { mock } from "bun:test";
import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  createPdfRunner,
  failing,
  ok,
  pandocTitleJson,
} from "../../actions/rendering/render-support";
import { createCapturedRuntime } from "../../../helpers/cli-test-utils";

const [mode, cwd] = process.argv.slice(2);
assert(cwd && (mode === "prepared" || mode === "retry"));
assert.equal(Bun.which("pandoc"), null, "fixture must run with Pandoc absent from PATH");

const input = join(cwd, "report.md");
const output = join(cwd, "report.pdf");
const profile = join(cwd, "generated.yml");
const { runtime, stdout, stderr } = createCapturedRuntime({ cwd });
const source = (title: string) => `---\ntitle: ${title}\n---\n\n# ${title}\n`;
await writeFile(input, source("Report"));
if (mode === "retry") await writeFile(output, "existing PDF");

const { runner: pdfRunner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
const snapshots: string[] = [];
const checkpoints: string[] = [];
let conversions = 0;
let commandCalls = 0;
let retries = 0;
let profileBeforeRetry: string | undefined;
const processUrl = new URL("../../../../src/cli/process.ts", import.meta.url).href;
mock.module(processUrl, () => ({
  execCommand: async (command: string, args: string[], options?: { cwd?: string }) => {
    commandCalls++;
    if (command !== "pandoc" || args.includes("--version"))
      return pdfRunner(command, args, options);

    assert.equal(options?.cwd, cwd);
    conversions++;
    const path = args[args.indexOf("--output") + 1]!;
    const target = args[args.indexOf("--to") + 1];
    if (target === "json") {
      const snapshot = await readFile(args[0]!, "utf8");
      const title = snapshots.length === 0 ? "Report" : "Revised report";
      assert.equal(snapshot, source(title));
      snapshots.push(title);
      checkpoints.push(path);
      await writeFile(path, pandocTitleJson(title, title));
      return ok();
    }
    assert.equal(args[args.indexOf("--from") + 1], "json");
    assert.equal(args[0], checkpoints.at(-1));
    assert(
      !(await readFile(args[args.indexOf("--template") + 1]!, "utf8")).includes("document-title"),
    );
    if (mode === "retry" && snapshots.length === 1) return failing("retry this writer");
    return pdfRunner(command, args, options);
  },
}));

const promptExports = { ...prompts };
mock.module("@inquirer/prompts", () => ({
  ...promptExports,
  select: async ({ message }: { message: string }) => {
    if (message === "PDF output destination") return "default";
    assert.equal(message, "Render recovery");
    assert.equal(retries++, 0);
    assert.equal(await readFile(output, "utf8"), "existing PDF");
    await assert.rejects(stat(dirname(checkpoints[0]!)), { code: "ENOENT" });
    profileBeforeRetry = await readFile(profile, "utf8");
    await writeFile(input, source("Revised report"));
    return "retry";
  },
  confirm: async ({ message }: { message: string }) => message === "Render this PDF?",
}));

if (mode === "prepared") {
  const { prepareMarkdownPdfRenderSource } =
    await import("../../../../src/cli/interactive/markdown/render-source");
  const { handlePreparedMarkdownPdfRender } =
    await import("../../../../src/cli/interactive/markdown/to-pdf/prepared-render");
  const { resolvePathPromptRuntimeConfig } =
    await import("../../../../src/cli/prompts/path-config");
  const { cwd, stdin, stdout } = runtime;
  const prepared = await prepareMarkdownPdfRenderSource(
    runtime,
    { input: { input }, kind: "selected", source: "built-in" },
    "inherit",
  );
  assert.equal(commandCalls, 0);
  assert.equal(
    await handlePreparedMarkdownPdfRender(
      runtime,
      { cwd, stdin, stdout, runtimeConfig: resolvePathPromptRuntimeConfig() },
      prepared,
    ),
    "done",
  );
} else {
  const { prepareMarkdownPdfDeterministicRecipe } =
    await import("../../../../src/cli/interactive/markdown/deterministic-authoring");
  const { bindPreparedMarkdownPdfGeneratedCandidate } =
    await import("../../../../src/cli/interactive/markdown/materialization");
  const { executeDurableMaterializationAndRender } =
    await import("../../../../src/cli/interactive/markdown/generated-lifecycle/recovery");
  const candidate = {
    kind: "deterministic" as const,
    candidate: prepareMarkdownPdfDeterministicRecipe({
      artifact: "profile",
      preparation: "starter",
    }),
  };
  const report = { kind: "none" } as const;
  const materialization = await bindPreparedMarkdownPdfGeneratedCandidate(runtime, candidate, {
    kind: "durable",
    output: profile,
    overwrite: false,
    report,
  });
  assert(materialization.kind === "durable");
  const state = { isWritten: false };
  assert.equal(
    await executeDurableMaterializationAndRender(
      runtime,
      {
        candidate,
        kind: "generated-lifecycle",
        lifecycle: "save-and-render",
        markdownInput: input,
        codeHighlight: "inherit",
        pageNumbers: "inherit",
        report,
      },
      { outputPath: output, overwrite: true },
      materialization,
      state,
    ),
    "complete",
  );
  assert.equal(state.isWritten, true);
  assert(profileBeforeRetry);
  assert.equal(await readFile(profile, "utf8"), profileBeforeRetry);
  assert.match(stderr.text, /HTML writer failed.*retry this writer/);
}

assert.equal(await readFile(output, "utf8"), "%PDF-1.7\n");
assert.match(stdout.text, /Wrote PDF/);
for (const checkpoint of checkpoints) {
  await assert.rejects(stat(dirname(checkpoint)), { code: "ENOENT" });
}
console.log(
  JSON.stringify({
    snapshots,
    conversions,
    retries,
    distinctCheckpoints: new Set(checkpoints).size,
  }),
);
