import assert from "node:assert/strict";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  createDocxEvidenceExtractor,
  extractDocumentTitleEvidenceForPath,
  buildDocumentPrompt,
  readCandidateDocx,
  __testOnlySuggestDocumentRenameTitlesWithBatch as suggestWithBatch,
  __testOnlySuggestDocumentRenameTitlesWithThread as suggestWithThread,
} from "./entry";
import { selectCodexDocumentTextCandidates } from "../../../../src/cli/actions/rename/codex/candidates";
import { buildDocxPackage, paragraph } from "../docx-baseline/corpus/builder";
import type { DocxReadResult } from "../../../../src/docx/types";

const mode = process.argv[2];
const path = process.argv[3]!;
const execution = { model: "Model-A", provider: "Provider-A", reasoningEffort: "high" } as const;

function title(result: Awaited<ReturnType<typeof extractDocumentTitleEvidenceForPath>>) {
  assert(result.evidence, JSON.stringify(result));
  assert.equal(result.evidence.metadata?.extractor, "docx-reader");
  return result.evidence.titleCandidates[0];
}

async function inputs(root: string) {
  const first = join(root, "first.docx");
  const second = join(root, "second.docx");
  const broken = join(root, "broken.docx");
  await writeFile(first, buildDocxPackage({ body: paragraph("First Product Report") }));
  await writeFile(second, buildDocxPackage({ body: paragraph("Second Product Report") }));
  await writeFile(broken, "invalid ZIP");
  return { first, second, broken };
}

function createProductObserver() {
  let read: DocxReadResult | undefined;
  const extract = createDocxEvidenceExtractor(async (input) => {
    read = await readCandidateDocx(input);
    return read;
  });
  return async (document: string, directory: string) => {
    read = undefined;
    const evidence = await extract(document);
    assert(read, "Expected the production extractor to read its document");
    const prompt =
      "reason" in evidence
        ? null
        : buildDocumentPrompt({
            evidences: [{ path: document, evidence }],
            workingDirectory: directory,
          });
    return { read, evidence, prompt };
  };
}

async function main() {
  if (mode === "extract") {
    process.stdout.write(JSON.stringify(await extractDocumentTitleEvidenceForPath(path)));
  } else if (mode === "observe-many") {
    const requests = JSON.parse(await readFile(path, "utf8")) as Array<{
      id: string;
      path: string;
      directory: string;
    }>;
    assert(
      requests.length > 0 && requests.length <= 70,
      "Expected a bounded DOCX regression slice",
    );
    const observe = createProductObserver();
    const observations = [];
    for (const request of requests)
      observations.push({
        id: request.id,
        observation: await observe(request.path, request.directory),
      });
    process.stdout.write(JSON.stringify(observations));
  } else if (mode === "sequential") {
    const { first, second, broken } = await inputs(path);
    const extract = createDocxEvidenceExtractor();
    const initial = await extract(first);
    assert(!("reason" in initial));
    assert.equal(initial.titleCandidates[0], "First Product Report");
    assert.deepEqual(await extract(broken), { reason: "docx_extract_error" });
    assert.deepEqual(await extract(join(path, "missing.docx")), { reason: "docx_extract_error" });
    const recovered = await extract(second);
    assert(!("reason" in recovered));
    assert.equal(recovered.titleCandidates[0], "Second Product Report");
    assert.equal(recovered.metadata?.extractor, "docx-reader");
    process.stdout.write(JSON.stringify({ passed: true }));
  } else if (mode === "batch") {
    const { first, second, broken } = await inputs(path);
    const attempts: string[] = [];
    let retainedExecution: unknown;
    const result = await suggestWithBatch(
      {
        documentPaths: [first, broken, second],
        workingDirectory: path,
        timeoutMs: 12_345,
        batchSize: 1,
        retries: 1,
        codexExecution: execution,
      },
      async (options) => {
        assert.equal(options.workingDirectory, path);
        assert.equal(options.timeoutMs, 12_345);
        assert.deepEqual(options.codexExecution, execution);
        if (retainedExecution) assert.equal(options.codexExecution, retainedExecution);
        retainedExecution = options.codexExecution;
        assert.equal(options.evidences.length, 1);
        const item = options.evidences[0]!;
        assert.equal(item.evidence.metadata?.extractor, "docx-reader");
        attempts.push(item.path);
        if (item.path === second) throw new Error("Synthetic provider failure");
        return { suggestions: [{ path: item.path, title: "First Product Report" }] };
      },
    );
    assert.deepEqual(attempts, [first, second, second]);
    assert.deepEqual(result.suggestions, [{ path: first, title: "First Product Report" }]);
    assert.deepEqual(result.reasons, [{ path: broken, reason: "docx_extract_error" }]);
    assert(result.errorMessage?.includes("Partial Codex suggestions"));
    assert(result.errorMessage?.includes("Synthetic provider failure"));
    process.stdout.write(JSON.stringify({ passed: true }));
  } else if (mode === "thread") {
    const { first, second, broken } = await inputs(path);
    let starts = 0;
    const result = await suggestWithThread(
      { documentPaths: [first, broken, second], workingDirectory: path, codexExecution: execution },
      async (cwd, options) => {
        starts += 1;
        assert.equal(cwd, path);
        assert.deepEqual(options?.codexExecution, execution);
        return {
          run: async (input, options) => {
            assert(Array.isArray(input));
            assert.equal(input.length, 1);
            assert.equal(input[0]?.type, "text");
            assert.equal(typeof input[0]?.text, "string");
            assert(input[0]!.text.includes("First Product Report"));
            assert(input[0]!.text.includes("Second Product Report"));
            assert(input[0]!.text.includes('"extractor": "docx-reader"'));
            assert(!input[0]!.text.includes("Provider-A"));
            assert(options?.signal instanceof AbortSignal);
            assert.deepEqual(options.outputSchema, {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { filename: { type: "string" }, title: { type: "string" } },
                    required: ["filename", "title"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            });
            return {
              items: [],
              finalResponse: JSON.stringify({
                suggestions: [
                  { filename: "first.docx", title: "First Product Report" },
                  { filename: "second.docx", title: "Second Product Report" },
                ],
              }),
              usage: null,
            };
          },
        };
      },
    );
    assert.equal(starts, 1);
    assert.deepEqual(result.suggestions, [
      { path: first, title: "First Product Report" },
      { path: second, title: "Second Product Report" },
    ]);
    assert.deepEqual(result.reasons, [{ path: broken, reason: "docx_extract_error" }]);
    process.stdout.write(JSON.stringify({ passed: true }));
  } else if (mode === "concurrent") {
    const { first, second } = await inputs(path);
    const calls: string[] = [];
    const operation = (document: string) =>
      suggestWithBatch({ documentPaths: [document], workingDirectory: path }, async (options) => {
        const item = options.evidences[0]!;
        calls.push(item.path);
        assert.equal(item.evidence.metadata?.extractor, "docx-reader");
        return { suggestions: [{ path: item.path, title: item.evidence.titleCandidates[0]! }] };
      });
    const results = await Promise.all([operation(first), operation(second)]);
    assert.deepEqual(calls.sort(), [first, second].sort());
    assert.deepEqual(
      results.map((result) => result.reasons),
      [[], []],
    );
    assert.deepEqual(
      results.map((result) => result.suggestions[0]?.title),
      ["First Product Report", "Second Product Report"],
    );
    process.stdout.write(JSON.stringify({ passed: true }));
  } else if (mode === "input-limits") {
    const MiB = 1024 * 1024;
    const paths: string[] = [];
    const options = {
      body: paragraph("Input Boundary Report"),
      extraParts: [["unused.bin", ""]] as [string, string | Buffer][],
    };
    const overhead = buildDocxPackage(options).length;
    for (const bytes of [8 * MiB, 8 * MiB + 1, 10 * MiB, 10 * MiB + 1]) {
      const file = join(path, `${bytes}.docx`);
      await writeFile(
        file,
        buildDocxPackage({
          ...options,
          extraParts: [["unused.bin", Buffer.alloc(bytes - overhead)]],
        }),
      );
      assert.equal((await stat(file)).size, bytes);
      paths.push(file);
    }
    const selection = await selectCodexDocumentTextCandidates(
      paths.map((fromPath) => ({ fromPath, toPath: `${fromPath}.renamed`, changed: true })),
    );
    assert.deepEqual(selection.eligiblePaths, paths.slice(0, 3));
    assert.equal(selection.skipReasonByPath.get(paths[3]!), "docx_skipped_too_large");
    assert.equal(
      title(await extractDocumentTitleEvidenceForPath(paths[0]!)),
      "Input Boundary Report",
    );
    for (const file of paths.slice(1, 3))
      assert.deepEqual(await extractDocumentTitleEvidenceForPath(file), {
        reason: "docx_extract_error",
      });
    let calls = 0;
    const result = await suggestWithBatch(
      { documentPaths: paths.slice(1, 3), workingDirectory: path },
      async () => {
        calls += 1;
        return { suggestions: [] };
      },
    );
    assert.equal(calls, 0);
    assert.deepEqual(result, {
      suggestions: [],
      reasons: paths.slice(1, 3).map((file) => ({ path: file, reason: "docx_extract_error" })),
    });
    process.stdout.write(JSON.stringify({ passed: true }));
  } else {
    throw new Error("Unknown DOCX product mode");
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
