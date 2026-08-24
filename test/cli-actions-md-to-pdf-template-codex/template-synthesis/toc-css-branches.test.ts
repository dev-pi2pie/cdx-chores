import { describe, expect, test } from "bun:test";

import { MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT } from "../../../src/cli/markdown-pdf/template-codex/families";
import { synthesizeMdPdfTemplateCodex } from "../../../src/cli/markdown-pdf/template-codex/synthesize";
import {
  createSynthesisOutputPlan,
  createSynthesisSignals,
} from "../../markdown-pdf/actions/template-synthesis-fixtures";
import { cssDeclarationBlocksForSelector } from "./css-assertions";

function expectTocPageBreakCss(
  styleCss: string,
  expected: { before?: "page"; after?: "page" },
): void {
  const tocBlocks = cssDeclarationBlocksForSelector(
    styleCss,
    MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.css.tocSelector,
  );
  expect(tocBlocks).toEqual(expect.arrayContaining([expect.objectContaining({ page: "toc" })]));
  const pageBreakBlock = tocBlocks.find(
    (block) => "break-before" in block || "break-after" in block,
  );
  if (!expected.before && !expected.after) {
    expect(pageBreakBlock).toBeUndefined();
    return;
  }
  expect(pageBreakBlock).toMatchObject({
    ...(expected.before ? { "break-before": expected.before } : {}),
    ...(expected.after ? { "break-after": expected.after } : {}),
  });
  if (!expected.before) {
    expect(pageBreakBlock).not.toHaveProperty("break-before");
  }
  if (!expected.after) {
    expect(pageBreakBlock).not.toHaveProperty("break-after");
  }
}

describe("cli action modules: md pdf-template codex template synthesis", () => {
  test("maps ToC page-break options into CSS branches", () => {
    const reportAuto = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({ preset: "report", toc: true }),
    });
    expectTocPageBreakCss(reportAuto.styleCss, { after: "page" });

    const articleAuto = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({ preset: "article", toc: true }),
    });
    expectTocPageBreakCss(articleAuto.styleCss, {});

    const explicitBefore = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: true,
        tocPageBreak: "before",
      }),
    });
    expectTocPageBreakCss(explicitBefore.styleCss, { before: "page" });

    const explicitAfter = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: true,
        tocPageBreak: "after",
      }),
    });
    expectTocPageBreakCss(explicitAfter.styleCss, { after: "page" });

    const explicitBoth = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: true,
        tocPageBreak: "both",
      }),
    });
    expectTocPageBreakCss(explicitBoth.styleCss, { before: "page", after: "page" });

    const explicitNone = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: true,
        tocPageBreak: "none",
      }),
    });
    expectTocPageBreakCss(explicitNone.styleCss, {});

    const tocDisabledAfter = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: false,
        tocPageBreak: "after",
      }),
    });
    expectTocPageBreakCss(tocDisabledAfter.styleCss, {});
  });
});
