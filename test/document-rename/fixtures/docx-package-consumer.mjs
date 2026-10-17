import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
const packageName = "cdx-chores";
const [format, sourceInput] = process.argv.slice(2);
assert.ok(format === "esm" || format === "cjs");
assert.equal(process.env.NODE_PATH, undefined);
const consumer = await realpath(process.cwd());
const contained = async (path) => {
  const canonical = await realpath(path);
  const location = relative(consumer, canonical);
  assert.ok(location !== ".." && !location.startsWith(`..${sep}`) && !isAbsolute(location));
  return canonical;
};
const entry = await contained(
  format === "esm" ? new URL(import.meta.resolve(packageName)) : require.resolve(packageName),
);
const product = format === "esm" ? await import(packageName) : require(packageName);
assert.equal(typeof product.runCli, "function");
const bin = join(consumer, "node_modules/.bin/cdx-chores");
assert.equal(
  await contained(bin),
  await realpath(join(consumer, "node_modules/cdx-chores/dist/esm/bin.mjs")),
);
const workspace = await mkdtemp(join(consumer, `check-${format}-`));
const stub = join(workspace, "codex-stub.mjs");
await writeFile(
  stub,
  String.raw`#!/usr/bin/env node
import { appendFile } from "node:fs/promises";
let prompt = "";
for await (const chunk of process.stdin) prompt += chunk;
await appendFile(process.env.CDX_DOCX_PACKAGE_CAPTURE, JSON.stringify({ prompt }) + "\n");
const evidence = JSON.parse(prompt.split("Document evidence JSON:\n")[1]);
const text = JSON.stringify({ suggestions: [{ filename: evidence[0].filename, title: "Installed metadata report" }] });
for (const event of [
  { type: "thread.started", thread_id: "synthetic-package-check" },
  { type: "turn.started" },
  { type: "item.completed", item: { id: "message", type: "agent_message", text } },
  { type: "turn.completed", usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 } },
]) process.stdout.write(JSON.stringify(event) + "\n");
`,
);
await chmod(stub, 0o755);

function argumentsFor(input) {
  return [
    "rename",
    "file",
    input,
    "--codex-docs",
    "--pattern",
    "{stem}",
    "--dry-run",
    "--codex-docs-timeout",
    "5s",
    "--codex-docs-retries",
    "0",
    "--no-color",
  ];
}

async function assertDryRun(result, directory, input, bytes, valid) {
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /Dry run only\. No files were renamed\./u);
  assert.match(result.stdout, valid ? /Codex doc titles: 1\/1/u : /Codex doc titles: 0\/1/u);
  const plan = result.stdout.match(/^Plan CSV: (.+)$/mu)?.[1];
  assert.ok(plan, "Dry run did not report a plan CSV");
  const rows = product.csvRowsToObjects(
    product.parseCsv(await readFile(join(directory, plan), "utf8")),
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].old_name, input);
  assert.equal(rows[0].new_name, valid ? "installed-metadata-report.docx" : input);
  assert.equal(rows[0].ai_new_name, valid ? "Installed metadata report" : "");
  assert.equal(rows[0].reason, valid ? "" : "docx_extract_error");
  assert.deepEqual(await readFile(join(directory, input)), bytes);
  if (valid)
    await assert.rejects(access(join(directory, "installed-metadata-report.docx")), {
      code: "ENOENT",
    });
}

for (const invocation of ["api", "bin"]) {
  const directory = join(workspace, invocation);
  await mkdir(directory);
  const input = "representative.docx";
  await copyFile(sourceInput, join(directory, input));
  const original = await readFile(join(directory, input));
  const invalid = "invalid.docx";
  const invalidBytes = Buffer.from("Synthetic invalid DOCX package");
  await writeFile(join(directory, invalid), invalidBytes);
  const capture = join(directory, "prompts.jsonl");
  const env = {
    ...process.env,
    CDX_CHORES_CODEX_PATH: stub,
    CDX_DOCX_PACKAGE_CAPTURE: capture,
    CODEX_API_KEY: "synthetic-package-check",
  };
  const invoke = async (file) => {
    if (invocation === "bin")
      return promisify(execFile)(process.execPath, [bin, ...argumentsFor(file)], {
        cwd: directory,
        env,
        encoding: "utf8",
        timeout: 10_000,
      });
    Object.assign(process.env, env);
    let stdout = "";
    let stderr = "";
    await product.runCli([process.execPath, packageName, ...argumentsFor(file)], {
      cwd: directory,
      colorEnabled: false,
      stdout: {
        write: (chunk) => {
          stdout += chunk;
          return true;
        },
      },
      stderr: {
        write: (chunk) => {
          stderr += chunk;
          return true;
        },
      },
    });
    assert.equal(process.exitCode ?? 0, 0, stderr);
    return { stdout, stderr };
  };
  await assertDryRun(await invoke(input), directory, input, original, true);
  const captured = await readFile(capture, "utf8");
  const requests = captured
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(requests.length, 1);
  const evidences = JSON.parse(requests[0].prompt.split("Document evidence JSON:\n")[1]);
  assert.equal(evidences.length, 1);
  const evidence = evidences[0];
  assert.equal(evidence.filename, input);
  assert.equal(evidence.basename, input);
  assert.equal(evidence.detectedType, "docx");
  assert.equal(evidence.titleCandidates[0], "Installed metadata report");
  assert.deepEqual(evidence.authorCandidates, ["Synthetic author"]);
  assert.deepEqual(evidence.headings, ["Installed Ω ∀🕿 report", "Installed note heading"]);
  assert.deepEqual(evidence.tocCandidates, evidence.headings);
  assert.equal(evidence.leadText, "Installed Ω ∀🕿 report Body report");
  assert.equal(evidence.metadata.title, "Installed metadata report");
  assert.equal(evidence.metadata.creator, "Synthetic author");
  assert.equal(evidence.metadata.extractor, "docx-reader+ooxml");
  await assertDryRun(await invoke(invalid), directory, invalid, invalidBytes, false);
  assert.equal(await readFile(capture, "utf8"), captured, "Invalid input reached the model stub");
  const extension = invocation === "api" && format === "cjs" ? "cjs" : "mjs";
  const parser = join(
    dirname(invocation === "api" ? entry : await realpath(bin)),
    `docx-parser.${extension}`,
  );
  const originalParser = await readFile(parser);
  const exportReader =
    extension === "mjs"
      ? "export { readDocxDocument };"
      : "exports.readDocxDocument = readDocxDocument;";
  try {
    for (const [module, method, argument] of [
      ["node:fs", "readFileSync", "/docx-baseline-synthetic-never-load.png"],
      ["node:child_process", "spawnSync", "docx-package-synthetic-denied"],
    ]) {
      const importProbe =
        extension === "mjs"
          ? `import { ${method} } from ${JSON.stringify(module)};`
          : `const { ${method} } = require(${JSON.stringify(module)});`;
      // A missing guard must yield usable evidence, so the fallback assertion fails.
      // Caught import-time violations still make the real worker reject these facts.
      await writeFile(
        parser,
        `${importProbe}
try { ${method}(${JSON.stringify(argument)}); } catch {}
function readDocxDocument() {
  return { ok: true, facts: { rawText: "Synthetic guard title", headings: [], hasContent: true, metadataResult: { warnings: [] }, diagnostics: [] } };
}
${exportReader}\n`,
      );
      await assertDryRun(await invoke(input), directory, input, original, false);
      assert.equal(
        await readFile(capture, "utf8"),
        captured,
        `${method} probe reached the model stub`,
      );
    }
  } finally {
    await writeFile(parser, originalParser);
  }
  await assertDryRun(await invoke(input), directory, input, original, true);
  const restoredRequests = (await readFile(capture, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    restoredRequests,
    [requests[0], requests[0]],
    "Restored parser changed extracted evidence",
  );
}
process.stdout.write(`${format}: passed yes\n`);
