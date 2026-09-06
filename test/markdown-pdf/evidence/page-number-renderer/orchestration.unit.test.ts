import { describe, expect, test } from "bun:test";

import {
  PAGE_NUMBER_COUNTER_EXPERIMENTS,
  PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS,
  PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS,
  WEASYPRINT_CANDIDATES,
} from "../../../fixtures/markdown-pdf/page-number-renderer-contract";
import type {
  ProjectRendererScenario,
  WeasyPrintCandidate,
} from "../../../fixtures/markdown-pdf/page-number-renderer-contract";

describe("Markdown PDF renderer evidence orchestration", () => {
  test("keeps the tested catalog concrete while accepting future candidate identities", () => {
    expect(WEASYPRINT_CANDIDATES.map((candidate) => candidate.weasyPrintVersion)).toEqual([
      "65.1",
      "68.0",
      "69.0",
    ]);

    const futureCandidate: WeasyPrintCandidate = {
      id: "wp-70-0-canary",
      weasyPrintVersion: "70.0rc1",
      dependencies: { pydyf: "0.12.2", fontTools: "4.64.0" },
    };
    const compatibleFutureScenario: Pick<ProjectRendererScenario, "candidateIds"> = {
      candidateIds: [futureCandidate.id],
    };

    expect(compatibleFutureScenario.candidateIds).toEqual(["wp-70-0-canary"]);

    const onePassExperiment = PAGE_NUMBER_COUNTER_EXPERIMENTS[0];
    expect(onePassExperiment).toBeDefined();
    expect(onePassExperiment?.html.match(/<main class="document-body">/gu)).toHaveLength(1);
    expect(onePassExperiment?.html.match(/<section class="fixture-page">/gu)).toHaveLength(3);
    const bodyGroup = onePassExperiment?.html.match(
      /<main class="document-body">(?<body>[\s\S]*?)<\/main>/u,
    )?.groups?.body;
    expect(bodyGroup).toContain("PH14.5-BODY-1");
    expect(bodyGroup).toContain("PH14.5-BODY-2");
    expect(bodyGroup).toContain("PH14.5-BODY-3");
    expect(onePassExperiment?.html).toContain("PH14.5-COVER");
    expect(onePassExperiment?.html).toContain("PH14.5-TOC");
    expect(onePassExperiment?.css).toContain(".document-body { page: body; }");
    expect(onePassExperiment?.css).not.toContain(".body-page");

    expect(PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      "product-built-in-document-origin",
      "product-explicit-body-origin",
      "product-custom-stylesheet-precedence",
      "product-built-in-automatic-metadata-title",
    ]);
    for (const scenario of PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.filter(
      (item) => item.id !== "product-custom-stylesheet-precedence",
    )) {
      expect(scenario.profile).toContain("{page}");
      expect(scenario.profile).toContain("{pages}");
      expect(scenario.profile).toContain("{pdfPage}");
      expect(scenario.profile).toContain("{pdfPages}");
    }
    expect(PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS[1]?.authoring).toEqual(
      expect.objectContaining({
        mode: "base-profile-only",
        baseProfile: expect.stringContaining("PROJECT-BASE-L{page}/{pages}-P{pdfPage}/{pdfPages}"),
      }),
    );

    const customTemplate = PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS[1];
    expect(customTemplate?.profile).toContain("pageBreak: none");
    expect(customTemplate?.profile).toContain("start: 5");
    expect(customTemplate?.expected.pages.map((page) => page.pageNumberLabels)).toEqual([
      [],
      ["PRODUCT-B-L5/9-P2/4"],
      ["PRODUCT-B-L7/9-P3/4"],
      ["PRODUCT-B-L9/9-P4/4"],
    ]);

    const insertedBlank = PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS[2];
    expect(insertedBlank?.profile).toContain("PRODUCT-C-P{pdfPage}/{pdfPages}");
    expect(insertedBlank?.profile).not.toContain("{page}");
    expect(insertedBlank?.profile).not.toContain("{pages}");
    expect(insertedBlank?.expected.pages.map((page) => page.role)).toEqual([
      "document-body",
      "inserted-blank",
      "document-body",
    ]);
    expect(insertedBlank?.expected.pages.map((page) => page.pageNumberLabels)).toEqual([
      ["PRODUCT-C-P1/3"],
      ["PRODUCT-C-P2/3"],
      ["PRODUCT-C-P3/3"],
    ]);

    const bodyVisibleDocumentOrigin = PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS[0];
    expect(bodyVisibleDocumentOrigin?.profile).toContain("scope: body");
    expect(bodyVisibleDocumentOrigin?.profile).toContain("countFrom: document");
    expect(bodyVisibleDocumentOrigin?.expected.pages.map((page) => page.pageNumberLabels)).toEqual([
      [],
      [],
      ["PRODUCT-A-L4/8-P3/5"],
      ["PRODUCT-A-L6/8-P4/5"],
      ["PRODUCT-A-L8/8-P5/5"],
    ]);
    expect(bodyVisibleDocumentOrigin?.markdown).toContain("company: PRODUCT-A-COMPANY-ONCE");
    expect(bodyVisibleDocumentOrigin?.expected.textOccurrences).toEqual([
      {
        text: "PRODUCT-A-COMPANY-ONCE",
        count: 1,
        physicalPages: [1],
      },
    ]);
  });
});
