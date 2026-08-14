import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../cli-interactive-routing.helpers";

const TO_PDF_ENTRY = ["md", "md:to-pdf"];

function temporaryProfileSelections(...recovery: string[]) {
  return [
    ...TO_PDF_ENTRY,
    "generated",
    "profile",
    "starter",
    "temporary-render",
    "inherit",
    "inherit",
    "default",
    ...recovery,
  ];
}

describe("interactive Markdown PDF generated lifecycle", () => {
  test.each([
    ["temporary-render", "inherit", undefined],
    ["temporary-render", "enable", true],
    ["temporary-render", "disable", false],
    ["save-and-render", "inherit", undefined],
    ["save-and-render", "enable", true],
    ["save-and-render", "disable", false],
  ] as const)(
    "passes %s with %s through deterministic renderer preparation",
    (lifecycle, choice, compiled) => {
      const durable = lifecycle === "save-and-render";
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...TO_PDF_ENTRY,
          "generated",
          "profile",
          "starter",
          lifecycle,
          choice,
          "inherit",
          ...(durable ? ["custom"] : []),
          "default",
        ],
        requiredPathQueue: [
          "fixtures/report.md",
          ...(durable ? [`recipes/matrix-${choice}.yml`] : []),
        ],
        confirmQueue: durable ? [false, false, true] : [false, true],
      });

      expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
      expect(result.markdownPdfDeterministicBindCalls).toHaveLength(1);
      expect(result.markdownPdfDeterministicWriteCalls).toHaveLength(1);
      expect(result.markdownPdfPrepareCalls).toHaveLength(1);
      if (compiled === undefined) {
        expect(result.markdownPdfPrepareCalls[0]).not.toHaveProperty("codeHighlight");
      } else {
        expect(result.markdownPdfPrepareCalls[0]).toEqual(
          expect.objectContaining({ codeHighlight: compiled }),
        );
      }
      expect(result.markdownPdfExecuteCalls).toHaveLength(1);
    },
  );

  test.each(
    (["profile", "template-bundle"] as const).flatMap((artifact) =>
      (["inherit", "enable", "disable"] as const).map((choice) => [artifact, choice] as const),
    ),
  )("passes deterministic %s page numbers %s to the materialized artifact", (artifact, choice) => {
    const compiled = choice === "inherit" ? undefined : choice === "enable";
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        artifact,
        "starter",
        "temporary-render",
        "inherit",
        choice,
        "default",
      ],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toEqual([
      expect.objectContaining({ artifact, candidateId: "deterministic-1" }),
    ]);
    expect(result.markdownPdfDeterministicBindCalls).toEqual([
      expect.objectContaining({ artifact, candidateId: "deterministic-1" }),
    ]);
    expect(result.markdownPdfPrepareCalls).toHaveLength(1);
    if (compiled !== undefined) {
      expect(result.markdownPdfPrepareCalls[0]).toEqual(
        expect.objectContaining({ pageNumbers: compiled }),
      );
    }
    if (compiled === undefined) {
      expect(result.markdownPdfPrepareCalls[0]).not.toHaveProperty("pageNumbers");
    }
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([
      { artifact, candidateId: "deterministic-1" },
    ]);
  });

  test.each(["back", "cancel"] as const)(
    "handles initial code-highlighting %s before output selection or materialization",
    (action) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...TO_PDF_ENTRY,
          "generated",
          "profile",
          "starter",
          "temporary-render",
          action,
          ...(action === "back" ? ["cancel"] : []),
        ],
        requiredPathQueue: ["fixtures/report.md"],
      });

      expect(result.selectDefaultsByMessage["Code highlighting for this PDF"]).toEqual(["inherit"]);
      expect(result.promptCalls.some((call) => call.message === "PDF output destination")).toBe(
        false,
      );
      expect(result.markdownPdfDeterministicBindCalls).toEqual([]);
      expect(result.markdownPdfDeterministicWriteCalls).toEqual([]);
      expect(result.markdownPdfPrepareCalls).toEqual([]);
      expect(result.markdownPdfPlanCalls).toEqual([]);
      expect(result.markdownPdfSessionCreateCalls).toEqual([]);
    },
  );

  test.each(["back", "cancel"] as const)(
    "handles initial page-number %s before output selection or materialization",
    (action) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...TO_PDF_ENTRY,
          "generated",
          "profile",
          "starter",
          "temporary-render",
          "inherit",
          action,
          ...(action === "back" ? ["back", "cancel"] : []),
        ],
        requiredPathQueue: ["fixtures/report.md"],
      });

      expect(result.promptCalls.some((call) => call.message === "PDF output destination")).toBe(
        false,
      );
      expect(result.markdownPdfDeterministicBindCalls).toEqual([]);
      expect(result.markdownPdfDeterministicWriteCalls).toEqual([]);
      expect(result.markdownPdfPrepareCalls).toEqual([]);
      expect(result.markdownPdfPlanCalls).toEqual([]);
      expect(result.markdownPdfSessionCreateCalls).toEqual([]);
    },
  );

  test("retains an override while returning to the same candidate lifecycle", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "profile",
        "starter",
        "temporary-render",
        "enable",
        "inherit",
        "default",
        "review",
        "temporary-render",
        "enable",
        "cancel",
      ],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, false],
    });

    expect(result.selectDefaultsByMessage["Code highlighting for this PDF"]).toEqual([
      "inherit",
      "enable",
    ]);
    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicBindCalls).toEqual([]);
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
  });

  test("retains both overrides while returning to the same candidate lifecycle", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "profile",
        "starter",
        "temporary-render",
        "enable",
        "disable",
        "default",
        "review",
        "temporary-render",
        "enable",
        "cancel",
      ],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, false],
    });

    expect(result.selectDefaultsByMessage["Code highlighting for this PDF"]).toEqual([
      "inherit",
      "enable",
    ]);
    expect(result.selectDefaultsByMessage["Page numbers for this PDF"]).toEqual([
      "inherit",
      "disable",
    ]);
    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([]);
  });

  test("changes generated final-review page numbers without rebinding or rewriting", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "template-bundle",
        "starter",
        "save-and-render",
        "inherit",
        "inherit",
        "custom",
        "default",
        "change-page-numbers",
        "enable",
      ],
      requiredPathQueue: ["fixtures/report.md", "recipes/durable-template"],
      confirmQueue: [false, false, false, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicBindCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toHaveLength(1);
    expect(result.markdownPdfPrepareCalls).toEqual([
      expect.objectContaining({ pageNumbers: true }),
    ]);
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
  });

  test("resets an override after revising a deterministic candidate", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "profile",
        "formal-guide",
        "article",
        "A4",
        "preset-default",
        "preset-default",
        "light-plus",
        "none",
        "temporary-render",
        "enable",
        "inherit",
        "default",
        "review",
        "revise-layout",
        "wide-table",
        "Letter",
        "preset-default",
        "temporary-render",
        "cancel",
      ],
      requiredPathQueue: ["fixtures/report.md"],
      inputQueue: ["", "", "", "", "", ""],
      confirmQueue: [false, true, true, true, false, false, false, false, false],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(2);
    expect(result.selectDefaultsByMessage["Code highlighting for this PDF"]).toEqual([
      "inherit",
      "inherit",
    ]);
    expect(result.markdownPdfDeterministicBindCalls).toEqual([]);
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([]);
  });

  test("resets an override after changing the deterministic artifact", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "profile",
        "starter",
        "temporary-render",
        "enable",
        "inherit",
        "default",
        "review",
        "change-artifact",
        "template-bundle",
        "starter",
        "temporary-render",
        "cancel",
      ],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, false],
    });

    expect(result.markdownPdfDeterministicPrepareCalls.map((call) => call.artifact)).toEqual([
      "profile",
      "template-bundle",
    ]);
    expect(result.selectDefaultsByMessage["Code highlighting for this PDF"]).toEqual([
      "inherit",
      "inherit",
    ]);
  });

  test("resets an override after changing deterministic preparation mode", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "profile",
        "starter",
        "temporary-render",
        "enable",
        "inherit",
        "default",
        "review",
        "change-mode",
        "formal-guide",
        "article",
        "A4",
        "preset-default",
        "preset-default",
        "none",
        "temporary-render",
        "cancel",
      ],
      requiredPathQueue: ["fixtures/report.md"],
      inputQueue: ["", "", "", "", "", ""],
      confirmQueue: [false, false, false, false, false, false, false],
    });

    expect(result.markdownPdfDeterministicPrepareCalls.map((call) => call.preparation)).toEqual([
      "starter",
      "formal-guide",
    ]);
    expect(result.selectDefaultsByMessage["Code highlighting for this PDF"]).toEqual([
      "inherit",
      "inherit",
    ]);
  });

  test("removes the exact owned session after a successful temporary render", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: temporaryProfileSelections(),
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfSessionCreateCalls).toHaveLength(1);
    expect(result.markdownPdfSessionCleanupCalls).toEqual(result.markdownPdfSessionCreateCalls);
    expect(result.removedPaths).toEqual(result.markdownPdfSessionCreateCalls);
    expect(result.markdownPdfPrepareCalls[0]).not.toHaveProperty("codeHighlight");
  });

  test("retries the same render plan without preparing or writing again", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfRenderErrorMessages: ["first render failed"],
      selectQueue: temporaryProfileSelections("retry"),
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicBindCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toHaveLength(1);
    expect(result.markdownPdfPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfExecuteCalls).toHaveLength(2);
    expect(new Set(result.markdownPdfExecuteCalls.map((call) => call.preparedId)).size).toBe(1);
    expect(result.markdownPdfSessionCleanupCalls).toHaveLength(1);
  });

  test("retains diagnostics and returns to the same candidate review", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfRenderErrorMessages: ["render failed"],
      selectQueue: temporaryProfileSelections("review", "cancel"),
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfSessionRetainCalls).toEqual(result.markdownPdfSessionCreateCalls);
    expect(result.markdownPdfSessionCleanupCalls).toEqual([]);
    expect(result.stderr.match(/Markdown PDF recipe review/g)).toHaveLength(2);
  });

  test("retains an enabled override through recovery review for the same candidate", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfRenderErrorMessages: ["render failed"],
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "profile",
        "starter",
        "temporary-render",
        "enable",
        "inherit",
        "default",
        "review",
        "temporary-render",
        "cancel",
      ],
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true],
    });

    expect(result.selectDefaultsByMessage["Code highlighting for this PDF"]).toEqual([
      "inherit",
      "enable",
    ]);
    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicBindCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toHaveLength(1);
    expect(result.markdownPdfSessionRetainCalls).toEqual(result.markdownPdfSessionCreateCalls);
  });

  test("keeps a failed temporary session and exits", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfRenderErrorMessages: ["render failed"],
      selectQueue: temporaryProfileSelections("keep"),
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfSessionRetainCalls).toEqual(result.markdownPdfSessionCreateCalls);
    expect(result.stderr).toContain(
      `Temporary recipe session retained:\n${result.markdownPdfSessionCreateCalls[0]}\n`,
    );
  });

  test("deletes only the confirmed failed temporary session", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfRenderErrorMessages: ["render failed"],
      selectQueue: temporaryProfileSelections("delete"),
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true, true],
    });

    expect(result.markdownPdfSessionCleanupCalls).toEqual(result.markdownPdfSessionCreateCalls);
    expect(result.removedPaths).toEqual(result.markdownPdfSessionCreateCalls);
  });

  test("keeps a successful PDF when temporary cleanup fails", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfCleanupErrorMessage: "cleanup denied",
      selectQueue: temporaryProfileSelections(),
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
    expect(result.markdownPdfSessionCleanupCalls).toEqual(result.markdownPdfSessionCreateCalls);
    expect(result.removedPaths).toEqual([]);
    expect(result.stdout).toContain("Wrote PDF:");
    expect(result.stderr).toContain("cleanup denied");
    expect(result.stderr).toContain(
      `Temporary recipe session retained:\n${result.markdownPdfSessionCreateCalls[0]}\n`,
    );
  });

  test("retains a temporary session when renderer preparation fails", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfPrepareErrorMessage: "bundle admission failed",
      selectQueue: temporaryProfileSelections("keep"),
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, true],
    });

    expect(result.markdownPdfDeterministicWriteCalls).toHaveLength(1);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
    expect(result.markdownPdfSessionRetainCalls).toEqual(result.markdownPdfSessionCreateCalls);
  });

  test("rejects a PDF output inside the owned temporary session", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "profile",
        "starter",
        "temporary-render",
        "inherit",
        "inherit",
        "custom",
        "delete",
      ],
      requiredPathQueue: ["fixtures/report.md", ".harness-md-pdf-session-1/output.pdf"],
      confirmQueue: [false, true, true],
    });

    expect(result.markdownPdfDeterministicBindCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([]);
    expect(result.markdownPdfPrepareCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
    expect(result.markdownPdfSessionCleanupCalls).toEqual(result.markdownPdfSessionCreateCalls);
    expect(result.stderr).toContain("PDF output must be outside the temporary recipe session");
  });

  test("rejects a PDF output that would overwrite a durable recipe file", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "profile",
        "starter",
        "save-and-render",
        "inherit",
        "inherit",
        "custom",
        "custom",
        "review",
        "cancel",
      ],
      requiredPathQueue: [
        "fixtures/report.md",
        "recipes/durable-profile.yml",
        "recipes/durable-profile.yml",
      ],
      confirmQueue: [false, false],
    });

    expect(result.markdownPdfDeterministicBindCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([]);
    expect(result.markdownPdfPrepareCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
    expect(result.stderr).toContain("PDF output must be different from generated recipe");
  });

  test("rejects a PDF output equal to a durable bundle directory", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "template-bundle",
        "starter",
        "save-and-render",
        "inherit",
        "inherit",
        "custom",
        "custom",
        "review",
        "cancel",
      ],
      requiredPathQueue: [
        "fixtures/report.md",
        "recipes/durable-template",
        "recipes/durable-template",
      ],
      confirmQueue: [false, false],
    });

    expect(result.markdownPdfDeterministicBindCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
    expect(result.stderr).toContain("PDF output must be different from generated recipe");
  });

  test("rejects a PDF output that would contain a generated recipe", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "profile",
        "starter",
        "save-and-render",
        "inherit",
        "inherit",
        "custom",
        "custom",
        "review",
        "cancel",
      ],
      requiredPathQueue: ["fixtures/report.md", "recipes/durable-profile.yml", "recipes"],
      confirmQueue: [false, false],
    });

    expect(result.markdownPdfDeterministicBindCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
    expect(result.stderr).toContain("PDF output must be different from generated recipe");
  });

  test("rejects a PDF output that would overwrite a with-artifact Codex report", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "project-bundle",
        "continue",
        "save-and-render",
        "inherit",
        "inherit",
        "with-artifact",
        "suggested",
        "custom",
        "review",
        "cancel",
      ],
      inputQueue: [""],
      requiredPathQueue: [
        "fixtures/report.md",
        "generated/codex-project-bundle-1/codex-report.json",
      ],
      confirmQueue: [false, true, false, false],
    });

    expect(result.markdownPdfCodexBindCalls).toHaveLength(1);
    expect(result.markdownPdfCodexWriteCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
    expect(result.stderr).toContain("PDF output must be different from generated recipe");
  });

  test("rejects a PDF output that would overwrite an external Codex report", () => {
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
        "external",
        "custom",
        "review",
        "cancel",
      ],
      inputQueue: [""],
      requiredPathQueue: ["fixtures/report.md", "reports/render.json", "reports/render.json"],
      confirmQueue: [false, true, false],
    });

    expect(result.markdownPdfCodexWriteCalls).toEqual([]);
    expect(result.markdownPdfSessionCreateCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
    expect(result.stderr).toContain("PDF and report paths must differ");
  });

  test("re-prompts generated PDF output after a recoverable resolution error", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfOutputErrorMessages: ["Output already exists"],
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "profile",
        "starter",
        "temporary-render",
        "inherit",
        "inherit",
        "default",
        "custom",
      ],
      requiredPathQueue: ["fixtures/report.md", "output/recovered.pdf"],
      confirmQueue: [false, true, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfPlanCalls).toHaveLength(2);
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
    expect(result.stderr).toContain("Unable to prepare PDF output: Output already exists");
  });

  test("returns from final render confirmation to the same generated recipe review", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      selectQueue: temporaryProfileSelections("review", "cancel"),
      requiredPathQueue: ["fixtures/report.md"],
      confirmQueue: [false, false],
    });

    expect(result.markdownPdfDeterministicWriteCalls).toEqual([]);
    expect(result.markdownPdfSessionCreateCalls).toEqual([]);
    expect(result.markdownPdfExecuteCalls).toEqual([]);
    expect(result.stderr.match(/Markdown PDF recipe review/g)).toHaveLength(2);
  });

  test("retries durable renderer preparation without rewriting the recipe", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfPrepareErrorMessages: ["bundle admission failed"],
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "template-bundle",
        "starter",
        "save-and-render",
        "inherit",
        "inherit",
        "custom",
        "default",
        "retry",
      ],
      requiredPathQueue: ["fixtures/report.md", "recipes/durable-template"],
      confirmQueue: [false, false, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toHaveLength(1);
    expect(result.markdownPdfPrepareCalls).toHaveLength(2);
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
  });

  test("retries durable materialization from the same accepted candidate", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfDeterministicWriteErrorMessages: ["transient write failure"],
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "template-bundle",
        "starter",
        "save-and-render",
        "inherit",
        "inherit",
        "custom",
        "default",
        "retry",
      ],
      requiredPathQueue: ["fixtures/report.md", "recipes/durable-template"],
      confirmQueue: [false, false, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicBindCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toHaveLength(2);
    expect(result.markdownPdfPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
  });

  test("returns from durable renderer preparation failure to the same recipe review", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfPrepareErrorMessage: "bundle admission failed",
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "template-bundle",
        "starter",
        "save-and-render",
        "inherit",
        "inherit",
        "custom",
        "default",
        "review",
        "cancel",
      ],
      requiredPathQueue: ["fixtures/report.md", "recipes/durable-template"],
      confirmQueue: [false, false, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toHaveLength(1);
    expect(result.markdownPdfPrepareCalls).toHaveLength(1);
    expect(result.stderr.match(/Markdown PDF recipe review/g)).toHaveLength(2);
  });

  test("changes highlighting after durable preparation recovery without rewriting the recipe", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfPrepareErrorMessages: ["bundle admission failed"],
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "template-bundle",
        "starter",
        "save-and-render",
        "enable",
        "inherit",
        "custom",
        "default",
        "review",
        "save-and-render",
        "disable",
        "inherit",
      ],
      requiredPathQueue: ["fixtures/report.md", "recipes/durable-template"],
      confirmQueue: [false, false, true, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicBindCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toHaveLength(1);
    expect(result.markdownPdfPrepareCalls).toEqual([
      expect.objectContaining({ codeHighlight: true }),
      expect.objectContaining({ codeHighlight: false }),
    ]);
    expect(result.markdownPdfExecuteCalls).toHaveLength(1);
  });

  test("changes PDF output after durable preparation recovery without rewriting the recipe", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfPrepareErrorMessages: ["bundle admission failed"],
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "template-bundle",
        "starter",
        "save-and-render",
        "inherit",
        "inherit",
        "custom",
        "default",
        "review",
        "save-and-render",
        "inherit",
        "inherit",
        "outputs",
        "custom",
      ],
      requiredPathQueue: ["fixtures/report.md", "recipes/durable-template", "output/recovered.pdf"],
      confirmQueue: [false, false, true, false, false, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicBindCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toHaveLength(1);
    expect(result.markdownPdfPlanCalls).toHaveLength(2);
    expect(result.markdownPdfPrepareCalls).toHaveLength(2);
    expect(result.markdownPdfExecuteCalls).toEqual([
      expect.objectContaining({
        outputPath: expect.stringMatching(/output\/recovered\.pdf$/),
      }),
    ]);
    expect(
      result.selectChoicesByMessage["Final render next step"]?.find(
        (choice) => choice.value === "outputs",
      )?.name,
    ).toBe("Change PDF output");
  });

  test("re-prompts a colliding PDF output after durable preparation recovery", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfPrepareErrorMessages: ["bundle admission failed"],
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "template-bundle",
        "starter",
        "save-and-render",
        "inherit",
        "inherit",
        "custom",
        "default",
        "review",
        "save-and-render",
        "inherit",
        "inherit",
        "outputs",
        "custom",
        "custom",
      ],
      requiredPathQueue: [
        "fixtures/report.md",
        "recipes/durable-template",
        "recipes/durable-template/template.html",
        "output/recovered.pdf",
      ],
      confirmQueue: [false, false, true, false, false, false, true],
    });

    expect(result.markdownPdfDeterministicBindCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toHaveLength(1);
    expect(result.markdownPdfPlanCalls).toHaveLength(3);
    expect(result.markdownPdfExecuteCalls).toEqual([
      expect.objectContaining({
        outputPath: expect.stringMatching(/output\/recovered\.pdf$/),
      }),
    ]);
    expect(result.stderr).toContain(
      "Unable to prepare PDF output: PDF output must be different from generated recipe",
    );
  });

  test("retries durable rendering without cleanup or regeneration", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfRenderErrorMessages: ["durable render failed"],
      selectQueue: [
        ...TO_PDF_ENTRY,
        "generated",
        "template-bundle",
        "starter",
        "save-and-render",
        "inherit",
        "inherit",
        "custom",
        "default",
        "retry",
      ],
      requiredPathQueue: ["fixtures/report.md", "recipes/durable-template"],
      confirmQueue: [false, false, true],
    });

    expect(result.markdownPdfDeterministicPrepareCalls).toHaveLength(1);
    expect(result.markdownPdfDeterministicWriteCalls).toHaveLength(1);
    expect(result.markdownPdfExecuteCalls).toHaveLength(2);
    expect(result.markdownPdfSessionCreateCalls).toEqual([]);
    expect(result.markdownPdfSessionCleanupCalls).toEqual([]);
  });
});
