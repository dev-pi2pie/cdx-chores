import { describe, expect, test } from "bun:test";

import { runInteractiveHarness, stripAnsi } from "./helpers";

describe("interactive data stack codex review", () => {
  test("reviews and accepts interactive data stack Codex recommendations before writing", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "accept",
        "strict",
        "json",
        "codex",
        "accept",
        "write",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true, true],
      dataStackCodexRecommendations: [
        {
          confidence: 0.91,
          id: "rec_unique_id",
          patches: [{ op: "replace", path: "/duplicates/uniqueBy", value: ["id"] }],
          reasoningSummary: "The id column has unique values in the sampled rows.",
          title: "Use id as the unique key",
        },
      ],
    });

    expect(result.codexReportWrites).toEqual([
      {
        path: expect.stringContaining("data-stack-codex-report-20260225T000000Z-testabcd.json"),
        options: { recommendationCount: 1 },
      },
    ]);
    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      acceptedRecommendationIds: ["rec_unique_id"],
      derivedFromPayloadId: "stack-payload-test",
      recommendationDecisions: [
        expect.objectContaining({
          decision: "accepted",
          recommendationId: "rec_unique_id",
        }),
      ],
      uniqueBy: ["id"],
    });
    expect(result.actionCalls).toEqual([
      {
        name: "data:stack",
        options: expect.objectContaining({
          uniqueBy: ["id"],
        }),
      },
    ]);
    expect(stripAnsi(result.stderr)).toContain("Accepted Codex changes");
    expect(stripAnsi(result.stderr)).toContain("Re-running stack status preview");
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Stack plan action",
      ),
    ).toHaveLength(1);
    expect(
      result.promptCalls.filter(
        (call) => call.kind === "select" && call.message === "Codex-powered analysis checkpoint",
      ),
    ).toHaveLength(1);
  });

  test("reviews edited interactive data stack Codex patches before writing", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "accept",
        "strict",
        "json",
        "codex",
        "edit",
        "write",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      editorQueue: [
        JSON.stringify([{ op: "replace", path: "/duplicates/policy", value: "report" }], null, 2),
      ],
      confirmQueue: [false, true, true],
      dataStackCodexRecommendations: [
        {
          confidence: 0.8,
          id: "rec_duplicate_policy",
          patches: [{ op: "replace", path: "/duplicates/policy", value: "reject" }],
          reasoningSummary: "Duplicate policy should be explicit.",
          title: "Set duplicate policy",
        },
      ],
    });

    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      duplicatePolicy: "report",
      recommendationDecisions: [
        expect.objectContaining({
          decision: "edited",
          recommendationId: "rec_duplicate_policy",
        }),
      ],
    });
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "editor:Edit recommendation patches JSON",
    );
  });

  test("saves an accepted interactive Codex recommendation in dry-run-only mode", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "accept",
        "strict",
        "json",
        "codex",
        "accept",
        "dry-run",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined, undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, false, true],
      dataStackCodexRecommendations: [
        {
          confidence: 0.91,
          id: "rec_unique_id",
          patches: [{ op: "replace", path: "/duplicates/uniqueBy", value: ["id"] }],
          reasoningSummary: "The id column has unique values in the sampled rows.",
          title: "Use id as the unique key",
        },
      ],
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.codexReportWrites).toEqual([]);
    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      acceptedRecommendationIds: ["rec_unique_id"],
      reportPath: null,
      uniqueBy: ["id"],
    });
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toContain(
      "confirm:Keep diagnostic/advisory report?",
    );
    expect(result.removedPaths).toEqual([]);
    expect(stripAnsi(result.stderr)).toContain("Skipped diagnostic/advisory report.");
    expect(result.stderr).toContain("Dry run: wrote stack plan");
  });

  test("can keep the interactive Codex advisory report separately", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "accept",
        "strict",
        "json",
        "codex",
        "skip",
        "write",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true, true],
      dataStackCodexRecommendations: [
        {
          confidence: 0.7,
          id: "rec_unique_id",
          patches: [{ op: "replace", path: "/duplicates/uniqueBy", value: ["id"] }],
          reasoningSummary: "Potential unique key.",
          title: "Use id as the unique key",
        },
      ],
    });

    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      acceptedRecommendationIds: [],
      reportPath: expect.stringContaining("data-stack-codex-report-20260225T000000Z-testabcd.json"),
      uniqueBy: [],
    });
    expect(result.codexReportWrites).toEqual([
      {
        path: expect.stringContaining("data-stack-codex-report-20260225T000000Z-testabcd.json"),
        options: { recommendationCount: 1 },
      },
    ]);
    expect(result.removedPaths).toEqual([]);
    expect(stripAnsi(result.stderr)).toContain("Codex assist: wrote advisory report");
  });

  test("keeps deterministic setup when interactive Codex review is cancelled", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "accept",
        "strict",
        "json",
        "codex",
        "cancel",
        "write",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true, true],
      dataStackCodexRecommendations: [
        {
          confidence: 0.7,
          id: "rec_unique_id",
          patches: [{ op: "replace", path: "/duplicates/uniqueBy", value: ["id"] }],
          reasoningSummary: "Potential unique key.",
          title: "Use id as the unique key",
        },
      ],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "data:stack",
        options: expect.not.objectContaining({
          uniqueBy: ["id"],
        }),
      },
    ]);
    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      acceptedRecommendationIds: [],
      uniqueBy: [],
    });
    expect(stripAnsi(result.stderr)).toContain("No Codex recommendations accepted.");
  });

  test("keeps deterministic setup when interactive Codex recommendation application fails", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: [
        "data",
        "data:stack",
        "csv",
        "accept",
        "strict",
        "json",
        "codex",
        "accept",
        "write",
      ],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true, true],
      dataStackCodexRecommendations: [
        {
          confidence: 0.7,
          id: "rec_unknown_key",
          patches: [{ op: "replace", path: "/duplicates/uniqueBy", value: ["missing"] }],
          reasoningSummary: "Invalid key in test.",
          title: "Use missing as the unique key",
        },
      ],
    });

    expect(result.actionCalls).toHaveLength(1);
    expect(result.stackPlanWrites[0]?.options).toMatchObject({
      acceptedRecommendationIds: [],
      uniqueBy: [],
    });
    expect(stripAnsi(result.stderr)).toContain("Codex recommendation application failed:");
    expect(stripAnsi(result.stderr)).toContain("Keeping current deterministic stack setup.");
  });

  test("keeps interactive data stack setup when Codex recommendations fail", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "accept", "strict", "json", "codex", "write"],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true],
      dataStackCodexErrorMessage:
        '{"type":"error","error":{"type":"invalid_request_error","code":"invalid_json_schema","message":"Invalid schema for response_format"}}',
      stdoutIsTTY: true,
    });

    expect(result.codexReportWrites).toHaveLength(0);
    expect(result.actionCalls).toHaveLength(1);
    expect(result.stdout.endsWith("\r\u001b[2K")).toBe(true);
    expect(stripAnsi(result.stderr)).toContain(
      "Codex stack recommendations unavailable: Codex rejected the structured recommendation schema.",
    );
    expect(stripAnsi(result.stderr)).not.toContain("invalid_json_schema");
    expect(stripAnsi(result.stderr)).not.toContain("invalid_request_error");
    expect(stripAnsi(result.stderr)).not.toContain("response_format");
    expect(stripAnsi(result.stderr)).toContain("Keeping current deterministic stack setup.");
  });

  test("keeps interactive data stack setup when Codex recommendations fail with plain text", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "data:stack", "csv", "accept", "strict", "json", "codex", "write"],
      requiredPathQueue: ["examples/playground/stack-cases/csv-matching-headers"],
      optionalPathQueue: [undefined],
      inputQueue: ["*.csv"],
      confirmQueue: [false, true],
      dataStackCodexErrorMessage: "mocked Codex outage",
      stdoutIsTTY: true,
    });

    expect(result.codexReportWrites).toHaveLength(0);
    expect(result.actionCalls).toHaveLength(1);
    expect(result.stdout.endsWith("\r\u001b[2K")).toBe(true);
    expect(stripAnsi(result.stderr)).toContain(
      "Codex stack recommendations unavailable. Review failed before recommendations were returned.",
    );
    expect(stripAnsi(result.stderr)).not.toContain("mocked Codex outage");
    expect(stripAnsi(result.stderr)).toContain("Keeping current deterministic stack setup.");
  });
});
