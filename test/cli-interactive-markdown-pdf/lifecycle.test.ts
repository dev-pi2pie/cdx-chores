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
    "default",
    ...recovery,
  ];
}

describe("interactive Markdown PDF generated lifecycle", () => {
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
        "custom",
        "delete",
      ],
      requiredPathQueue: ["fixtures/report.md", ".harness-md-pdf-session-1/output.pdf"],
      confirmQueue: [false, true, true],
    });

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

    expect(result.markdownPdfDeterministicWriteCalls).toEqual([]);
    expect(result.markdownPdfPrepareCalls).toEqual([]);
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
