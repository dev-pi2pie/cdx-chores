import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import type { MarkdownPdfCodexProfileRequest } from "../../../../src/adapters/codex/markdown-pdf-profile";
import {
  createMarkdownPdfCodexReportArtifact,
  readMarkdownPdfCodexReportArtifact,
  writeMarkdownPdfCodexReportArtifact,
} from "../../../../src/cli/markdown-pdf/codex-report";
import { withTempFixtureDir } from "../../../helpers/cli-test-utils";

const PAGE_LABEL = "PRIVATE_PAGE_LABEL_7b2";
const HEADER_TEXT = "PRIVATE_HEADER_TEXT_8c3";
const ECHO = "PRIVATE_CODEX_ECHO_9d4";

const pageInformation = {
  pageNumbers: {
    enabled: true as const,
    position: "top-right" as const,
    format: PAGE_LABEL,
    scope: "body" as const,
    countFrom: "body" as const,
    start: 1,
    increment: 1,
  },
  repeatingContent: {
    enabled: true as const,
    selected: ["top-right" as const],
    text: { "top-right": HEADER_TEXT },
  },
};

const finalProfile = {
  pageNumbers: { ...pageInformation.pageNumbers },
  header: { right: HEADER_TEXT },
};

const request = {
  candidates: [],
  documentSignals: { available: false },
  fontSignals: {},
  fontHints: [],
  signalMode: "basic-default",
} as unknown as MarkdownPdfCodexProfileRequest;

function createReport(input: {
  modelCallAttempted: boolean;
  failure?: boolean;
  failureKind?: "unavailable" | "no-usable-profile";
}) {
  return createMarkdownPdfCodexReportArtifact({
    createdAt: "2026-09-23T00:00:00.000Z",
    displayProfileOutputPath: "profile.yml",
    profileIdentity: {
      id: "md-pdf-profile-20260923T000000Z-a1b2c3d4",
      source: "deterministic",
      createdAt: "2026-09-23T00:00:00.000Z",
    },
    request,
    pageInformation,
    finalProfile: input.failure ? undefined : finalProfile,
    slotResolution: {
      position: "top-right",
      choice: "retain",
      conflictingText: HEADER_TEXT,
    },
    modelCallAttempted: input.modelCallAttempted,
    result: input.failure
      ? undefined
      : {
          profile: finalProfile,
          decision: {
            acceptedFontPatches: [
              { op: "replace-font", role: "body", key: "default", value: ECHO },
            ],
            acceptedPatches: [{ op: "replace", path: "/header/right", value: HEADER_TEXT }],
            decisionMode: "adapted",
            fallbackReason: ECHO,
            reasoning: ECHO,
            selectedCandidateId: "default",
            unmatchedDirections: [ECHO],
            warnings: [ECHO],
          },
        },
    failure: input.failure
      ? { kind: input.failureKind ?? "unavailable", message: ECHO }
      : undefined,
  });
}

describe("Profile Codex page-information diagnostic report", () => {
  test("keeps only requested and validated final metadata on attempted calls", () => {
    const report = createReport({ modelCallAttempted: true });
    const json = JSON.stringify(report);
    expect(json).not.toContain(PAGE_LABEL);
    expect(json).not.toContain(HEADER_TEXT);
    expect(json).not.toContain(ECHO);
    expect(report.pageInformation).toMatchObject({
      modelResultDetails: "omitted",
      pageNumbers: {
        requested: { choice: "on", scope: "body", position: "top-right" },
        final: { enabled: true, scope: "body", position: "top-right" },
      },
      repeatingContent: {
        requested: { choice: "on", selectedPositions: ["top-right"] },
        final: {
          storedPositions: ["top-right"],
          reservedNumberPosition: "top-right",
          reservedSlotOutcome: "retain",
        },
      },
    });
    expect(report.result.decision).toBeUndefined();
    expect(report.result.warnings).toEqual([]);
  });

  test("marks pre-call failure without final metadata and accepts old v4 reports", async () => {
    await withTempFixtureDir("md-pdf-page-info-report-reader", async (fixtureDir) => {
      const path = join(fixtureDir, "report.json");
      const report = createReport({ modelCallAttempted: false, failure: true });
      await writeMarkdownPdfCodexReportArtifact(path, report);
      const written = await readFile(path, "utf8");
      expect(written).not.toContain(ECHO);
      expect((await readMarkdownPdfCodexReportArtifact(path)).pageInformation).toMatchObject({
        modelResultDetails: "not-requested",
        pageNumbers: { requested: { choice: "on" } },
      });
      expect(report.pageInformation?.pageNumbers.final).toBeUndefined();
      const oldReport = { ...report };
      delete oldReport.pageInformation;
      await writeFile(path, `${JSON.stringify(oldReport)}\n`, "utf8");
      expect((await readMarkdownPdfCodexReportArtifact(path)).pageInformation).toBeUndefined();
    });
  });

  test("omits model echoes on no-usable Profile results", () => {
    const report = createReport({
      modelCallAttempted: true,
      failure: true,
      failureKind: "no-usable-profile",
    });
    expect(report.pageInformation?.modelResultDetails).toBe("omitted");
    expect(report.result.failure).toEqual({
      kind: "no-usable-profile",
      message: "Codex Profile preparation failed.",
    });
    expect(JSON.stringify(report)).not.toContain(ECHO);
    expect(report.pageInformation?.pageNumbers.final).toBeUndefined();
  });

  test("rejects page text and unsupported values in the optional metadata", async () => {
    await withTempFixtureDir("md-pdf-page-info-report-validation", async (fixtureDir) => {
      const path = join(fixtureDir, "report.json");
      const report = createReport({ modelCallAttempted: true });
      await writeFile(
        path,
        JSON.stringify({
          ...report,
          pageInformation: {
            ...report.pageInformation,
            pageNumbers: {
              ...report.pageInformation?.pageNumbers,
              requested: { choice: "on", format: PAGE_LABEL },
            },
          },
        }),
        "utf8",
      );
      await expect(readMarkdownPdfCodexReportArtifact(path)).rejects.toThrow(
        "page-information metadata is invalid",
      );
    });
  });
});
