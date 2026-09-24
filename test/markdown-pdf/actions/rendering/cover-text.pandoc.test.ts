import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, type DefaultTreeAdapterTypes } from "parse5";

import { registerFixtureOutput } from "../../../../scripts/testing/fixtures/fixture-exports";
import { createMarkdownPdfTemplate } from "../../../../src/cli/markdown-pdf/recipe";
import {
  createMarkdownPdfCoverScaffold,
  normalizeMarkdownPdfProfile,
} from "../../../../src/cli/markdown-pdf/profile";
import { renderMarkdownPdf } from "../../../../src/cli/markdown-pdf/render";
import { normalizeMarkdownPdfOptions } from "../../../../src/cli/markdown-pdf/validation";
import { withPandocFixtureDir } from "../../pandoc-support";

type Node = DefaultTreeAdapterTypes.Node;

function textContent(node: Node): string {
  return "value" in node
    ? node.value
    : "childNodes" in node
      ? node.childNodes.map(textContent).join("")
      : "";
}

function elementsWithClass(node: Node, className: string): Node[] {
  const matches =
    "attrs" in node &&
    node.attrs.some((attr) => attr.name === "class" && attr.value.split(/\s+/).includes(className));
  return [
    ...(matches ? [node] : []),
    ...("childNodes" in node
      ? node.childNodes.flatMap((child) => elementsWithClass(child, className))
      : []),
  ];
}

describe("literal cover text through Pandoc", () => {
  test.each(["built-in", "managed-project"] as const)(
    "preserves currency, template syntax, and HTML-sensitive text in %s covers",
    async (kind) => {
      await withPandocFixtureDir(`md-pdf-cover-text-${kind}`, async (dir, runPandoc) => {
        const title = 'Budget $100 to $200 & <draft> "Q4"';
        const subtitle = "Literal $title$, $body$, $if(title)$, and $$";
        const author = "Author $5";
        const company = "Company <team> & $10";
        const date = "Date $20";
        const profile = normalizeMarkdownPdfProfile({
          profile: {
            metadata: { title, subtitle, author, company, date },
            cover: { enabled: true, style: "report" },
          },
        }).profile;
        const templateHtml =
          kind === "built-in"
            ? createMarkdownPdfTemplate({ profile })
            : `<!-- cdx-chores md pdf-template codex | bundle=test | family=document-layered -->
<html><body>
${createMarkdownPdfCoverScaffold(profile)}<main class="document-body">$body$</main>
</body></html>`;
        const templatePath = join(dir, "template.html");
        const inputPath = join(dir, "source.md");
        const htmlPath = join(dir, "rendered.html");
        await writeFile(templatePath, templateHtml);
        await writeFile(inputPath, "---\ntitle: Different Pandoc title\n---\n# Body sentinel\n");
        registerFixtureOutput(dir, {
          source: htmlPath,
          name: `${kind}.html`,
          kind: "generated",
          required: true,
        });
        await renderMarkdownPdf({
          inputPath,
          outputPath: join(dir, "stub.pdf"),
          htmlOutputPath: htmlPath,
          templateHtml,
          ...(kind === "managed-project" ? { customTemplatePath: templatePath } : {}),
          profile,
          pageNumbers: profile.pageNumbers,
          bodyBoundary: "not-required",
          options: normalizeMarkdownPdfOptions({}),
          runner: async (command, args) => {
            if (command === "pandoc") {
              const result = await runPandoc(args);
              return {
                ok: result.ok,
                code: result.exitCode,
                signal: null,
                stdout: result.stdout,
                stderr: result.stderr,
              };
            }
            // This lane validates real Pandoc output; PDF layout is covered by smoke renders.
            expect(command).toBe("weasyprint");
            await writeFile(args.at(-1)!, "%PDF stub");
            return { ok: true, code: 0, signal: null, stdout: "", stderr: "" };
          },
        });
        const document = parse(await readFile(htmlPath, "utf8"));
        for (const [className, expected] of [
          ["pdf-cover__title", title],
          ["pdf-cover__subtitle", subtitle],
          ["pdf-cover__company", company],
          ["pdf-cover__meta", `${author} | ${date}`],
        ]) {
          const elements = elementsWithClass(document, className!);
          expect(elements).toHaveLength(1);
          expect(textContent(elements[0]!)).toBe(expected!);
        }
        expect(elementsWithClass(document, "pdf-cover")).toHaveLength(1);
        expect(textContent(document)).toMatch(/Body\s+sentinel/);
        expect(await readFile(templatePath, "utf8")).toBe(templateHtml);
      });
    },
    20_000,
  );
});
