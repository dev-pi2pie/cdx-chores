import assert from "node:assert/strict";
import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { prepareMarkdownPdfProfileCodex } from "../../../../src/cli/markdown-pdf/profile-codex/prepare";
import { prepareMdPdfProjectCodex } from "../../../../src/cli/markdown-pdf/project-codex";
import { prepareMdPdfTemplateCodex } from "../../../../src/cli/markdown-pdf/template-codex";
import { createActionTestRuntime } from "../../../helpers/cli-action-test-utils";
import {
  adaptedProfileResponse,
  adaptedTemplateResponse,
  BASE_PROFILE,
} from "../project-codex/prepared-fixtures";
import { minimalPng } from "../template-codex/fixtures";
import { offlineBoundaryCases } from "./list-block-boundaries";

const availability = process.argv[2];
assert(availability === "present" || availability === "absent");
assert.equal(Boolean(Bun.which("pandoc")), availability === "present");

const labels = Array.from({ length: 13 }, (_, index) => "example-" + (index + 1));
const wideRow = "| Original source width | 1 |";
const markdown = [
  "---\ntitle: Visible report\nlang: en\n---",
  "<textarea>\n\n# Literal heading\n\n| Literal | Row |\n\n~~~hidden\ncode\n~~~\n</textarea>",
  "<div>",
  "# Visible report",
  "<summary>Notes</summary>\n~~~excluded\nexample\n~~~",
  [
    "| Key | Count |",
    "| --- | ----- |",
    wideRow,
    ...Array(48).fill("| X | 1 |"),
    "| Overflow row with a much greater source width | 2 | 3 |",
  ].join("\n"),
  labels
    .concat(labels[12]!)
    .map((label, index) =>
      index === 0
        ? "\n<h2>Example</h2>\n~~~" + label + "\n# Hidden heading\n| Hidden | Row |\n~~~"
        : "\n~~~" + label + "\nexample\n~~~",
    )
    .join("\n"),
  "~~~\nunlabeled\n~~~",
  "```{=html}\n# Raw body\n| Raw | Row |\n```",
  "    indented example",
  "latin ".repeat(4000),
].join("\n\n");

const cwd = process.cwd();
await Promise.all([
  writeFile(join(cwd, "base.yml"), BASE_PROFILE),
  writeFile(join(cwd, "cover.png"), minimalPng(1200, 800)),
]);

const { runtime } = createActionTestRuntime({ cwd, now: () => new Date("2026-11-22T12:00:00Z") });
const common = {
  dryRun: true,
  input: "report.md",
  intent: "Prepare a report with a cover.",
};
async function authoringSignals(name: string, source: string) {
  await writeFile(join(cwd, common.input), source);
  const profile = await prepareMarkdownPdfProfileCodex(runtime, {
    ...common,
    baseProfile: "base.yml",
    codexRunner: async () => adaptedProfileResponse(),
    output: "profile.yml",
  });
  assert.equal(profile.kind, "profile");
  const template = await prepareMdPdfTemplateCodex(runtime, {
    ...common,
    coverImage: "cover.png",
    codexRunner: async () =>
      adaptedTemplateResponse().replace('"renderer-default"', '"explicit-recipe"'),
    output: "template",
    preset: "article",
  });
  const project = await prepareMdPdfProjectCodex(runtime, {
    ...common,
    baseProfile: "base.yml",
    coverImage: "cover.png",
    profileCodexRunner: async () => adaptedProfileResponse(),
    templateCodexRunner: async () => adaptedTemplateResponse(),
    output: "project",
  });
  assert.equal(
    template.synthesis.decisionMode,
    "adapted",
    JSON.stringify(template.synthesis.warnings),
  );
  assert.equal(project.binding.validation.decisionMode, "adapted");

  const signals = profile.reportPayload.request.documentSignals;
  assert.deepEqual(template.signals.documentSignals, signals, name);
  assert.deepEqual(project.signals.shared.document, signals, name);
  return signals;
}

const signals = await authoringSignals("limits", markdown);
assert.deepEqual(signals.headings, { total: 1, maxDepth: 1, byDepth: { 1: 1 } });
assert.deepEqual(signals.tables, {
  scannedRows: 50,
  maxColumns: 2,
  maxLineWidth: wideRow.length,
  overflowRows: 2,
});
assert.deepEqual(signals.codeFences, {
  languages: labels.slice(0, 12),
  unlabeledCount: 1,
  overflowLanguageCount: 1,
});
assert.deepEqual(signals.title, {
  frontmatterTitle: { present: true, charCount: 14 },
  firstH1: { present: true, charCount: 14 },
  normalizedTitleMatch: true,
  duplicateVisibleTitleRisk: true,
});
assert.equal(signals.scripts.scannedChars, 20_000);
assert.equal(signals.scripts.truncated, true);
assert(!JSON.stringify(signals).includes("Original source width"));
const results = [signals];
for (const fixture of offlineBoundaryCases) {
  const actual = await authoringSignals(fixture.name, fixture.markdown);
  const total = fixture.headings.length;
  assert.deepEqual(actual.headings, { total, maxDepth: 1, byDepth: { 1: total } }, fixture.name);
  assert.deepEqual(
    actual.title.firstH1,
    { present: true, charCount: fixture.headings[0]!.length },
    fixture.name,
  );
  assert.deepEqual(actual.codeFences.languages, fixture.languages, fixture.name);
  assert.equal(actual.tables.scannedRows, fixture.rows, fixture.name);
  results.push(actual);
}
assert.deepEqual((await readdir(cwd)).sort(), ["base.yml", "cover.png", "report.md"]);
process.stdout.write(JSON.stringify(results));
