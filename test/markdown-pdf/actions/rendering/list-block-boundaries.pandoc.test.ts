import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "bun:test";

import { withPandocFixtureDir } from "../../pandoc-support";
import {
  htmlBoundaryCases,
  listBoundaryCases,
  listTransitionCases,
  pipeBody,
} from "../fixtures/list-block-boundaries";

// Keep reader-specific list ancestry, code attributes and text. Ignore unrelated table schema changes.
function project(blocks: unknown) {
  const events: unknown[] = [];
  function visit(value: unknown, lists: string[]) {
    if (Array.isArray(value)) {
      for (const child of value) visit(child, lists);
      return;
    }
    if (!value || typeof value !== "object" || !("t" in value) || !("c" in value)) return;
    const { t, c } = value;
    if (t === "Header" || t === "CodeBlock") {
      assert.ok(Array.isArray(c));
      events.push(t === "Header" ? [t, c[0], c[2]] : [t, lists, c[0][1], c[1]]);
      return;
    }
    visit(c, t === "OrderedList" || t === "BulletList" ? [...lists, t] : lists);
  }
  visit(blocks, []);
  return events;
}

function h1(text: string) {
  const inlines = text
    .split(" ")
    .flatMap((word, i) => [...(i ? [{ t: "Space" }] : []), { t: "Str", c: word }]);
  return ["Header", 1, inlines];
}
function code(text: string, language = "", lists: string[] = []) {
  return ["CodeBlock", lists, language ? [language] : [], text];
}

const recovered = h1("Recovered heading");
const literal = h1("Literal heading");
const before = h1("Literal heading before apparent fence");
const visible = h1("Visible heading");
const bulletPython = code(pipeBody, "python", ["BulletList"]);
const bulletExample = code("example", "", ["BulletList"]);
const documentPython = code(pipeBody, "python");
const ordered = ["OrderedList"];
const bullets = ["BulletList", "BulletList"];
const js = code("\n# Example heading\n", "js");
const strayCloser = code("~~~");
const swallowedJs = code("\n~~~js\n\n# Example heading\n");
const shellComment = code("-->", "sh");
const shellTextarea = code("</textarea>", "sh");
const emptyLiteral = code("~~~python\n" + pipeBody + "\n~~~", "", bullets);
const topLiteral = code("```python\n" + pipeBody + "\n```");

// Each pair lists the events preceding the final visible H1, first on 2.0 and then on 3.9.
const readers: Record<string, [unknown[], unknown[]]> = {
  "parent-after-verse": [[bulletPython], [bulletPython]],
  "parent-after-table": [[bulletPython], [bulletPython]],
  "document-after-table": [[code(pipeBody, "python")], [code(pipeBody, "python")]],
  "adjacent-sibling-opener": [[bulletPython], [bulletPython]],
  "prose-after-tilde-block": [[bulletExample, documentPython], [bulletExample]],
  "prose-after-backtick-block": [
    [bulletExample, documentPython],
    [bulletExample, documentPython],
  ],
  numbered: [[], [code(pipeBody, "python", ordered)]],
  "nested-verse": [[], [code(pipeBody, "python")]],
  "document-verse": [[], []],
  "empty-six": [[], [code(pipeBody, "python", bullets)]],
  "empty-seven": [[emptyLiteral], [emptyLiteral]],
  "padded-seven": [[], [code(pipeBody, "python", bullets)]],
  "document-fence": [[code(pipeBody, "python")], [code(pipeBody, "python")]],
  "document-literal": [[topLiteral], [topLiteral]],
  "comment-document": [[js], [swallowedJs]],
  "comment-item": [
    [strayCloser, js],
    [strayCloser, js],
  ],
  "comment-around-textarea-heading": [
    [strayCloser, js],
    [strayCloser, js],
  ],
  "comment-around-textarea-prose": [
    [strayCloser, js],
    [strayCloser, js],
  ],
  "comment-document-early-close": [
    [recovered, shellComment, js],
    [recovered, shellComment, js],
  ],
  "comment-item-early-close": [
    [recovered, js],
    [recovered, code("-->", "sh", ordered), js],
  ],
  "textarea-document": [[recovered, shellTextarea, js], [swallowedJs]],
  "textarea-item": [
    [recovered, js],
    [strayCloser, js],
  ],
  "textarea-document-early-close": [
    [recovered, shellTextarea, js],
    [recovered, shellTextarea, js],
  ],
  "textarea-item-early-close": [
    [recovered, js],
    [recovered, code("</textarea>", "sh", ordered), js],
  ],
  "closer-in-item": [
    [recovered, js],
    [strayCloser, js],
  ],
  "closer-in-sibling": [[recovered, js], [js]],
  "genuine-close-after-document": [
    [before, code("</textarea>\n| Hidden | Code |", "python"), literal, js],
    [code("\n# Literal heading\n| Hidden | Row |\n</textarea>\n~~~js\n\n# Example heading\n")],
  ],
  "genuine-close-after-item": [
    [before, literal, js],
    [code("| Hidden | Code |\n~~~"), literal, js],
  ],
  "closed-textarea": [[code("</textarea>", "text")], []],
};

test("Pandoc list boundaries match the verified readers and top-level controls", async () => {
  await withPandocFixtureDir("md-pdf-list-boundaries", async (dir, runPandoc) => {
    const version = (await runPandoc(["--version"])).stdout.split(/\r?\n/)[0];
    const cases = [...listBoundaryCases, ...listTransitionCases, ...htmlBoundaryCases];
    assert.deepEqual(Object.keys(readers).sort(), cases.map(({ name }) => name).sort());
    const path = join(dir, "case.md");
    for (const { name, markdown } of cases) {
      // Other supported versions exercise the two common controls.
      if (
        version !== "pandoc 2.0" &&
        version !== "pandoc 3.9" &&
        name !== "document-fence" &&
        name !== "document-literal"
      )
        continue;
      await writeFile(path, markdown);
      const result = await runPandoc(["--from=markdown", "--to=json", path]);
      const expected = readers[name]![version === "pandoc 2.0" ? 0 : 1];
      assert.deepEqual(
        project(JSON.parse(result.stdout).blocks),
        [...expected, visible],
        name + " on " + version,
      );
    }
  });
}, 30_000);
