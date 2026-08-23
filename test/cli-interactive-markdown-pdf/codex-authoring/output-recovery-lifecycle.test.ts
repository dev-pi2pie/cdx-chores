import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../../cli-interactive-routing.helpers";
import { TO_PDF_ENTRY, recipesCodexSelections } from "./fixtures";

describe("interactive Markdown PDF Codex authoring", () => {
  test("changes output and report binding without preparing the candidate again", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfCodexBindErrorMessage: "Output already exists",
      markdownPdfCodexFinalProfile: {
        code: {
          highlight: true,
          theme: "light-plus",
          lineNumbers: true,
          transformerNotation: false,
        },
        pageNumbers: {
          enabled: true,
          scope: "body",
          countFrom: "body",
          start: 0,
          increment: 2,
          position: "top-right",
          format: "Page {page}",
        },
        header: {
          left: "{company}",
          center: "",
          right: "{title}",
          style: { fontSize: "8pt", color: "#667085" },
        },
      },
      selectQueue: [
        ...recipesCodexSelections("profile"),
        "continue",
        "save",
        "external",
        "custom",
        "review",
        "save",
        "none",
        "custom",
        "exit",
      ],
      inputQueue: [""],
      requiredPathQueue: ["reports/first.json", "recipes/first.yml", "recipes/final.yml"],
      confirmQueue: [false, true, false, true, true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfCodexBindCalls).toEqual([
      expect.objectContaining({
        candidateId: "codex-profile-1",
        output: "recipes/first.yml",
        report: { kind: "external", path: "reports/first.json" },
      }),
      expect.objectContaining({
        candidateId: "codex-profile-1",
        output: "recipes/final.yml",
        report: { kind: "none" },
      }),
    ]);
    expect(result.markdownPdfCodexWriteCalls).toEqual([
      expect.objectContaining({
        candidateId: "codex-profile-1",
        outputPath: "recipes/final.yml",
      }),
    ]);
    expect(result.stderr).toContain("Unable to save recipe: Output already exists");
    expect(result.stderr.match(/Reusable Profile page numbering:/g)).toHaveLength(2);
    expect(result.stderr).toContain("- Start: 0");
    expect(result.stderr).toContain("- Increment: 2");
    expect(result.stderr).toContain("- capabilityId: pageNumbers.countFrom.body");
    expect(result.stderr).toContain("  requestedBy: pageNumbers.countFrom");
    expect(result.stderr).toContain("  minimumVersion: 65.1");
    expect(result.stderr).not.toContain("installed");
    expect(result.stderr).not.toContain("conditionId");
    expect(result.stderr).not.toContain("readiness");
  });

  test("escapes terminal controls in Interactive Codex Profile review", () => {
    const escape = "\u001B";
    const bell = "\u0007";
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfCodexFinalProfile: {
        pageNumbers: {
          enabled: true,
          format: `Page ${escape}]8;;https://example.invalid${bell}link {page}`,
        },
        header: {
          left: `${escape}[31mred${escape}[0m`,
          center: `${escape}]0;title${bell}`,
          right: "",
        },
      },
      selectQueue: [...recipesCodexSelections("profile"), "continue", "cancel"],
      inputQueue: [""],
      confirmQueue: [false, true],
    });

    expect(result.stderr).not.toContain(escape);
    expect(result.stderr).not.toContain(bell);
    expect(result.stderr).toContain(
      'Label: "Page \\u001b]8;;https://example.invalid\\u0007link {page}"',
    );
    expect(result.stderr).toContain('left="\\u001b[31mred\\u001b[0m"');
    expect(result.stderr).toContain('center="\\u001b]0;title\\u0007"');
  });

  test.each(["review", "cancel"] as const)(
    "offers immediate %s from output selection without destination binding",
    (next) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...recipesCodexSelections("profile"),
          "continue",
          "save",
          "none",
          next,
          ...(next === "review" ? ["cancel"] : []),
        ],
        inputQueue: [""],
        confirmQueue: [false, true],
      });

      expect(
        result.selectChoicesByMessage["Profile output destination"]?.map((choice) => choice.value),
      ).toEqual(["suggested", "custom", "review", "cancel"]);
      expect(result.markdownPdfCodexPrepareCalls).toHaveLength(1);
      expect(result.markdownPdfCodexBindCalls).toEqual([]);
      expect(result.markdownPdfCodexWriteCalls).toEqual([]);
    },
  );

  test.each(["review", "cancel"] as const)(
    "treats the custom output path %s as a destination instead of navigation",
    (output) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...recipesCodexSelections("template-bundle"),
          "continue",
          "save",
          "none",
          "custom",
          "exit",
        ],
        inputQueue: [""],
        requiredPathQueue: [output],
        confirmQueue: [false, true, false, true],
      });

      expect(result.markdownPdfCodexBindCalls).toEqual([expect.objectContaining({ output })]);
      expect(result.markdownPdfCodexWriteCalls).toHaveLength(1);
    },
  );

  test("uses an explicit Project save output exactly for a durable save", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...recipesCodexSelections("project-bundle"),
        "continue",
        "save",
        "none",
        "custom",
        "exit",
      ],
      inputQueue: [""],
      requiredPathQueue: ["recipes/exact-project"],
      confirmQueue: [false, true, false, true],
    });

    expect(result.markdownPdfCodexBindCalls).toEqual([
      expect.objectContaining({ output: "recipes/exact-project" }),
    ]);
  });

  test.each(["profile", "template-bundle", "project-bundle"] as const)(
    "removes acceptance actions for an unusable %s candidate",
    (artifact) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        markdownPdfCodexUnusableArtifacts: [artifact],
        selectQueue: [...recipesCodexSelections(artifact), "continue", "cancel"],
        inputQueue: [""],
        confirmQueue: [false, true],
      });

      expect(result.stderr).toContain("Codex request: no usable candidate");
      expect(
        result.selectChoicesByMessage["Recipe review next step"]?.map((choice) => choice.value),
      ).toEqual(["regenerate", "change-setup", "change-artifact", "cancel"]);
      expect(result.markdownPdfCodexBindCalls).toEqual([]);
      expect(result.markdownPdfCodexWriteCalls).toEqual([]);
      if (artifact === "project-bundle") {
        expect(result.stderr).toContain("Project artifacts: unavailable");
        expect(result.stderr).toContain("Follow-up render usability: unavailable");
        expect(result.stderr).not.toContain("Follow-up render: cdx-chores");
      }
    },
  );

  test.each(["profile", "template-bundle", "project-bundle"] as const)(
    "renders one generated %s with an enabled override and correct Profile ownership",
    (artifact) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...TO_PDF_ENTRY,
          "generated",
          artifact,
          ...(artifact === "project-bundle" ? [] : ["codex-assistant"]),
          "continue",
          "temporary-render",
          "enable",
          "inherit",
          "none",
          "default",
        ],
        inputQueue: [""],
        requiredPathQueue: ["fixtures/report.md"],
        confirmQueue: [false, true, false, true],
      });

      expect(result.markdownPdfCodexPrepareCalls).toHaveLength(1);
      expect(result.markdownPdfCodexBindCalls).toHaveLength(1);
      expect(result.markdownPdfCodexWriteCalls).toHaveLength(1);
      expect(result.markdownPdfPrepareCalls).toEqual([
        expect.objectContaining({ codeHighlight: true }),
      ]);
      expect(result.markdownPdfExecuteCalls).toHaveLength(1);
      expect(result.stderr.includes("Reusable Profile settings:")).toBe(
        artifact !== "template-bundle",
      );
      expect(
        result.promptCalls.filter((call) => call.message === "Choose preparation mode"),
      ).toHaveLength(artifact === "project-bundle" ? 0 : 1);
    },
  );

  test("temporary Project rendering resolves output only after lifecycle choice", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "project-bundle",
        "continue",
        "temporary-render",
        "inherit",
        "inherit",
        "none",
        "default",
      ],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true, false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfCodexBindCalls).toHaveLength(1);
    expect(result.markdownPdfCodexWriteCalls).toHaveLength(1);
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
  });

  test.each(["back", "cancel"] as const)(
    "handles initial Project code-highlighting %s before report output collection",
    (action) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...TO_PDF_ENTRY,
          "generated",
          "project-bundle",
          "continue",
          "temporary-render",
          action,
          ...(action === "back" ? ["cancel"] : []),
        ],
        inputQueue: [""],
        requiredPathQueue: ["fixtures/report.md"],
        confirmQueue: [false, true],
      });

      expect(
        result.promptCalls.some((call) => call.message === "Keep a Codex diagnostic report?"),
      ).toBe(false);
      expect(result.markdownPdfCodexPrepareCalls).toHaveLength(1);
      expect(result.markdownPdfCodexBindCalls).toEqual([]);
      expect(result.markdownPdfCodexWriteCalls).toEqual([]);
      expect(result.markdownPdfPlanCalls).toEqual([]);
      expect(result.markdownPdfExecuteCalls).toEqual([]);
    },
  );

  test.each(["profile", "template-bundle", "project-bundle"] as const)(
    "retains the same generated %s candidate and override across a lifecycle change",
    (artifact) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...TO_PDF_ENTRY,
          "generated",
          artifact,
          ...(artifact === "project-bundle" ? [] : ["codex-assistant"]),
          "continue",
          "temporary-render",
          "enable",
          "inherit",
          "none",
          "default",
          "review",
          "save-and-render",
          "enable",
          "inherit",
          "with-artifact",
          "cancel",
        ],
        inputQueue: [""],
        requiredPathQueue: ["fixtures/report.md"],
        confirmQueue: [false, true, false, false],
      });

      expect(result.markdownPdfCodexPrepareCalls).toHaveLength(1);
      expect(result.markdownPdfCodexPrepareCalls[0]?.candidateId).toBe(`codex-${artifact}-1`);
      expect(result.selectDefaultsByMessage["Code highlighting for this PDF"]).toEqual([
        "inherit",
        "enable",
      ]);
      expect(result.markdownPdfCodexBindCalls).toEqual([]);
      expect(result.markdownPdfCodexWriteCalls).toEqual([]);
      expect(result.markdownPdfPlanCalls).toHaveLength(1);
      expect(result.markdownPdfExecuteCalls).toEqual([]);
      expect(
        result.promptCalls.filter((call) => call.message === "Choose preparation mode"),
      ).toHaveLength(artifact === "project-bundle" ? 0 : 1);
    },
  );

  test("changes generated final-review highlighting without regenerating or rebinding outputs", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "project-bundle",
        "continue",
        "save-and-render",
        "enable",
        "inherit",
        "with-artifact",
        "suggested",
        "default",
        "change-code-highlighting",
        "disable",
      ],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true, false, false, false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfCodexBindCalls).toEqual([
      expect.objectContaining({
        candidateId: "codex-project-bundle-1",
        report: { kind: "with-artifact" },
      }),
    ]);
    expect(result.markdownPdfCodexWriteCalls).toEqual([
      expect.objectContaining({
        candidateId: "codex-project-bundle-1",
        report: { kind: "with-artifact" },
      }),
    ]);
    expect(result.markdownPdfPlanCalls).toHaveLength(1);
    expect(result.markdownPdfPrepareCalls).toEqual([
      expect.objectContaining({ codeHighlight: false }),
    ]);
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
    expect(result.selectDefaultsByMessage["Code highlighting for this PDF"]).toEqual([
      "inherit",
      "enable",
    ]);
    expect(result.promptCalls.filter((call) => call.message === "Choose preparation mode")).toEqual(
      [],
    );
    expect(result.stderr).toContain("Render override:\n- Disable for this render");
  });

  test.each(["profile", "template-bundle", "project-bundle"] as const)(
    "changes generated Codex %s page numbers at final review without regenerating or rebinding",
    (artifact) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...TO_PDF_ENTRY,
          "generated",
          artifact,
          ...(artifact === "project-bundle" ? [] : ["codex-assistant"]),
          "continue",
          "save-and-render",
          "inherit",
          "inherit",
          "with-artifact",
          "suggested",
          "default",
          "change-page-numbers",
          "enable",
        ],
        inputQueue: [""],
        requiredPathQueue: ["fixtures/report.md"],
        confirmQueue: [false, true, false, false, false, true],
      });

      expect(result.markdownPdfCodexPrepareCalls).toEqual([
        expect.objectContaining({ artifact, candidateId: `codex-${artifact}-1` }),
      ]);
      expect(result.markdownPdfCodexBindCalls).toHaveLength(1);
      expect(result.markdownPdfCodexWriteCalls).toHaveLength(1);
      expect(result.markdownPdfPrepareCalls).toEqual([
        expect.objectContaining({ pageNumbers: true }),
      ]);
      expect(result.markdownPdfExecuteCalls).toHaveLength(1);
    },
  );

  test("changes highlighting after Codex durable recovery without rewriting the recipe", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfPrepareErrorMessages: ["bundle admission failed"],
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "project-bundle",
        "continue",
        "save-and-render",
        "enable",
        "inherit",
        "with-artifact",
        "suggested",
        "default",
        "review",
        "save-and-render",
        "disable",
        "inherit",
        "with-artifact",
      ],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true, false, false, true, true],
    });

    expect(result.markdownPdfCodexPrepareCalls.map((call) => call.candidateId)).toEqual([
      "codex-project-bundle-1",
    ]);
    expect(result.markdownPdfCodexBindCalls).toHaveLength(1);
    expect(result.markdownPdfCodexWriteCalls).toHaveLength(1);
    expect(result.markdownPdfPrepareCalls).toEqual([
      expect.objectContaining({ codeHighlight: true }),
      expect.objectContaining({ codeHighlight: false }),
    ]);
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
    expect(result.selectDefaultsByMessage["Code highlighting for this PDF"]).toEqual([
      "inherit",
      "enable",
    ]);
    expect(
      result.promptCalls.filter((call) => call.message === "Keep a Codex diagnostic report?"),
    ).toHaveLength(2);
    expect(result.promptCalls.filter((call) => call.message === "Choose preparation mode")).toEqual(
      [],
    );
  });

  test("changes PDF output after Codex durable recovery without rewriting the recipe", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfPrepareErrorMessages: ["bundle admission failed"],
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "project-bundle",
        "continue",
        "save-and-render",
        "enable",
        "inherit",
        "with-artifact",
        "suggested",
        "default",
        "review",
        "save-and-render",
        "enable",
        "inherit",
        "with-artifact",
        "outputs",
        "custom",
      ],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/report.md", "output/recovered-codex.pdf"],
      confirmQueue: [false, true, false, false, true, false, false, true],
    });

    expect(result.markdownPdfCodexPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfCodexBindCalls).toHaveLength(1);
    expect(result.markdownPdfCodexWriteCalls).toHaveLength(1);
    expect(result.markdownPdfPlanCalls).toHaveLength(2);
    expect(result.markdownPdfPrepareCalls).toHaveLength(2);
    expect(result.markdownPdfExecuteCalls).toEqual([
      expect.objectContaining({
        outputPath: expect.stringMatching(/output\/recovered-codex\.pdf$/),
      }),
    ]);
    expect(
      result.selectChoicesByMessage["Final render next step"]?.find(
        (choice) => choice.value === "outputs",
      )?.name,
    ).toBe("Change PDF output");
  });

  test.each([
    ["back", true],
    ["cancel", false],
  ] as const)(
    "handles %s from generated final-review code highlighting without regenerating or rebinding",
    (action, renders) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...TO_PDF_ENTRY,
          "generated",
          "project-bundle",
          "continue",
          "save-and-render",
          "enable",
          "inherit",
          "with-artifact",
          "suggested",
          "default",
          "change-code-highlighting",
          action,
        ],
        inputQueue: [""],
        requiredPathQueue: ["fixtures/report.md"],
        confirmQueue: [false, true, false, false, false, ...(renders ? [true] : [])],
      });

      expect(result.markdownPdfCodexPrepareCalls).toHaveLength(1);
      expect(result.markdownPdfCodexBindCalls).toHaveLength(1);
      expect(result.selectDefaultsByMessage["Code highlighting for this PDF"]).toEqual([
        "inherit",
        "enable",
      ]);
      expect(result.markdownPdfCodexWriteCalls).toHaveLength(renders ? 1 : 0);
      expect(result.markdownPdfPlanCalls).toHaveLength(1);
      expect(result.markdownPdfPrepareCalls).toHaveLength(renders ? 1 : 0);
      expect(result.markdownPdfExecuteCalls).toHaveLength(renders ? 1 : 0);
      if (renders) {
        expect(result.markdownPdfPrepareCalls).toEqual([
          expect.objectContaining({ codeHighlight: true }),
        ]);
      }
    },
  );

  test.each([
    ["temporary-render", "external"],
    ["save-and-render", "with-artifact"],
  ] as const)(
    "materializes and renders accepted to-pdf lifecycle %s after report selection",
    (lifecycle, report) => {
      const requiredPathQueue = ["fixtures/report.md"];
      if (report === "external") {
        requiredPathQueue.push("reports/render.json");
      }
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...TO_PDF_ENTRY,
          "generated",
          "project-bundle",
          "continue",
          lifecycle,
          "inherit",
          "inherit",
          report,
          ...(lifecycle === "save-and-render" ? ["suggested"] : []),
          "default",
        ],
        inputQueue: [""],
        requiredPathQueue,
        confirmQueue:
          lifecycle === "save-and-render"
            ? [false, true, false, false, true]
            : [false, true, false, true],
      });

      expect(result.markdownPdfCodexPrepareCalls).toEqual([
        expect.objectContaining({
          artifact: "project-bundle",
          candidateId: "codex-project-bundle-1",
          sample: "fixtures/report.md",
        }),
      ]);
      expect(
        result.promptCalls.some((call) => call.message === "Markdown preparation sample"),
      ).toBe(false);
      expect(result.promptCalls).toContainEqual({
        kind: "select",
        message: "Keep a Codex diagnostic report?",
      });
      expect(result.markdownPdfCodexBindCalls).toHaveLength(1);
      expect(result.markdownPdfCodexWriteCalls).toHaveLength(1);
      expect(result.markdownPdfPlanCalls).toHaveLength(1);
      expect(result.markdownPdfExecuteCalls).toHaveLength(1);
    },
  );
});
