import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS,
  MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA,
  type MarkdownPdfCodexProfileRunner,
} from "../../src/adapters/codex/markdown-pdf-profile";
import {
  collectMdPdfProjectCodexSignals,
  normalizeMdPdfProjectCodexCommandState,
  planMdPdfProjectCodexOutput,
  runMdPdfProjectCodexProfilePhase,
  type MdPdfProjectCodexOptions,
} from "../../src/cli/markdown-pdf/project-codex";
import type { MarkdownPdfProjectCodexOutputPlan } from "../../src/cli/markdown-pdf/project-codex/types";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";
import { minimalPng, pathExists } from "../cli-actions-md-to-pdf-template-codex/fixtures";

type ProfilePhaseFixtureOptions = MdPdfProjectCodexOptions & {
  profileCodexRunner?: MarkdownPdfCodexProfileRunner;
};

afterEach(() => {
  mock.restore();
});

function adaptedProfileRunner(candidateId = "wide-table", unmatchedDirections: string[] = []) {
  return async () =>
    JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id: candidateId,
      accepted_patches: [{ op: "replace", path: "/toc/enabled", value: true }],
      accepted_font_patches: [
        { op: "replace-font", role: "body", key: "default", value: "Source Serif 4" },
      ],
      reasoning: "The project profile should adapt to the document signals.",
      warnings: ["profile warning"],
      fallback_reason: "",
      unmatched_directions: unmatchedDirections,
    });
}

function noUsableProfileRunner() {
  return async () =>
    JSON.stringify({
      decision_mode: "no-usable-profile",
      selected_candidate_id: "none",
      accepted_patches: [],
      accepted_font_patches: [],
      reasoning: "The requested profile directions are not representable.",
      warnings: ["unsupported profile direction"],
      fallback_reason: "No usable profile.",
      unmatched_directions: ["unsupported custom CSS"],
    });
}

function conservativeFallbackProfileRunner(candidateId = "wide-table") {
  return async () =>
    JSON.stringify({
      decision_mode: "conservative-fallback",
      selected_candidate_id: candidateId,
      accepted_patches: [{ op: "replace", path: "/toc/enabled", value: true }],
      accepted_font_patches: [],
      reasoning: "Use a conservative fallback for unsupported profile details.",
      warnings: ["fallback warning"],
      fallback_reason: "Unsupported profile details were ignored.",
      unmatched_directions: ["unsupported profile detail"],
    });
}

function profilePromptFacts(prompt: string): Record<string, unknown> {
  const marker = "Deterministic facts:\n";
  const index = prompt.indexOf(marker);
  if (index < 0) {
    throw new Error("profile Codex prompt did not include deterministic facts");
  }
  return JSON.parse(prompt.slice(index + marker.length)) as Record<string, unknown>;
}

function candidateSummaryIds(facts: Record<string, unknown>): string[] {
  return ((facts.candidateSummaries as Array<{ id: string }> | undefined) ?? []).map(
    (summary) => summary.id,
  );
}

async function expectNoPlannedProjectArtifacts(
  outputPlan: MarkdownPdfProjectCodexOutputPlan,
): Promise<void> {
  expect(await pathExists(outputPlan.outputDirectory)).toBe(false);
  expect(await pathExists(outputPlan.profile.path)).toBe(false);
  expect(await pathExists(outputPlan.templateHtml.path)).toBe(false);
  expect(await pathExists(outputPlan.styleCss.path)).toBe(false);
  for (const asset of outputPlan.assets) {
    expect(await pathExists(asset.path)).toBe(false);
  }
  if (outputPlan.report) {
    expect(await pathExists(outputPlan.report.path)).toBe(false);
  }
}

async function runProfilePhaseFixture(fixtureDir: string, options: ProfilePhaseFixtureOptions) {
  const { runtime, stderr } = createActionTestRuntime({
    cwd: fixtureDir,
    now: () => new Date("2026-07-04T08:00:00.000Z"),
  });
  const state = await normalizeMdPdfProjectCodexCommandState(runtime, options);
  const signals = await collectMdPdfProjectCodexSignals(runtime, state);
  const outputPlan = await planMdPdfProjectCodexOutput({
    identityUidFactory: () => "abc12345",
    runtime,
    signalMode: signals.modes.project,
    state,
  });
  const result = await runMdPdfProjectCodexProfilePhase({
    outputPlan,
    profileCodexRunner: options.profileCodexRunner,
    runtime,
    signals,
    state,
  });
  return { outputPlan, result, stderr };
}

describe("cli action modules: md pdf-project codex profile phase", () => {
  test("materializes deterministic profile results without writing profile.yml", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-profile-phase-deterministic",
      async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "base.yml"),
          "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\npage:\n  size: Letter\n",
          "utf8",
        );
        await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));
        let codexRunnerCallCount = 0;
        const unexpectedCodexRunner: MarkdownPdfCodexProfileRunner = async () => {
          codexRunnerCallCount += 1;
          throw new Error("deterministic profile phase must not invoke Codex");
        };

        const baseOnly = await runProfilePhaseFixture(fixtureDir, {
          baseProfile: "base.yml",
          profileCodexRunner: unexpectedCodexRunner,
        });
        expect(baseOnly.result.phase).toMatchObject({
          decisionMode: "deterministic",
          phase: "profile",
          signalMode: "base-only-deterministic",
        });
        expect(baseOnly.result.identity).toMatchObject({
          id: "md-pdf-profile-20260704T080000Z-abc12345",
          source: "deterministic",
          basedOn: "md-pdf-profile-20260101T000000Z-ba5e0001",
        });
        expect(baseOnly.result.finalProfile.profile).toMatchObject({
          id: "md-pdf-profile-20260704T080000Z-abc12345",
          source: "deterministic",
        });
        expect(baseOnly.result.serializedProfile).toContain(
          "id: md-pdf-profile-20260704T080000Z-abc12345",
        );
        expect(await pathExists(baseOnly.outputPlan.profile.path)).toBe(false);
        await expectNoPlannedProjectArtifacts(baseOnly.outputPlan);

        const coverOnly = await runProfilePhaseFixture(fixtureDir, {
          coverImage: "cover.png",
          profileCodexRunner: unexpectedCodexRunner,
        });
        expect(coverOnly.result.phase).toMatchObject({
          decisionMode: "deterministic",
          phase: "profile",
          signalMode: "basic-default",
        });
        expect(coverOnly.result.identity).toMatchObject({
          source: "deterministic",
          basedOn: "default",
        });
        await expectNoPlannedProjectArtifacts(coverOnly.outputPlan);
        expect(codexRunnerCallCount).toBe(0);
      },
    );
  });

  test("runs injected profile Codex adapter branch with bounded project request facts", async () => {
    await withTempFixtureDir("md-pdf-project-codex-profile-phase-codex", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "report.md"),
        "# Report\n\n| A | B | C |\n| - | - | - |\n| 1 | 2 | 3 |\n",
        "utf8",
      );
      await writeFile(
        join(fixtureDir, "base.yml"),
        "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\npage:\n  size: Letter\n",
        "utf8",
      );
      const capturedRequests: Array<{ facts: Record<string, unknown>; workingDirectory: string }> =
        [];
      const profileCodexRunner: MarkdownPdfCodexProfileRunner = async (options) => {
        capturedRequests.push({
          facts: profilePromptFacts(options.prompt),
          workingDirectory: options.workingDirectory,
        });
        return adaptedProfileRunner("base-profile", ["unsupported custom CSS"])();
      };

      const { outputPlan, result, stderr } = await runProfilePhaseFixture(fixtureDir, {
        baseProfile: "base.yml",
        fontHint: ["prefer Source Serif 4"],
        input: "report.md",
        intent: "wide table report with custom CSS",
        profileCodexRunner,
      });

      expect(stderr.text).toContain(
        "Requesting Codex Markdown PDF project profile recommendation...",
      );
      expect(result.phase).toMatchObject({
        decisionMode: "adapted",
        phase: "profile",
        signalMode: "mixed-with-base",
        warnings: ["profile warning"],
      });
      expect(capturedRequests).toHaveLength(1);
      expect(capturedRequests[0]?.workingDirectory).toBe(fixtureDir);
      expect(capturedRequests[0]?.facts).toMatchObject({
        fontHints: ["prefer Source Serif 4"],
        intent: "wide table report with custom CSS",
        selectedBaseProfileSummary: {
          basedOn: "md-pdf-profile-20260101T000000Z-ba5e0001",
          id: "base-profile",
        },
        signalMode: "mixed-with-base",
      });
      expect(capturedRequests[0]?.facts.documentSignals).toMatchObject({
        available: true,
        tables: { maxColumns: 3 },
      });
      expect(capturedRequests[0]?.facts.fontSignals).toMatchObject({
        families: [],
      });
      expect(capturedRequests[0]?.facts.supportedSchemaSummary).toContain("toc.enabled");
      expect(candidateSummaryIds(capturedRequests[0]?.facts ?? {})).toEqual(["base-profile"]);
      expect(capturedRequests[0]?.facts.candidateSummaries).toEqual([
        expect.objectContaining({ id: "base-profile" }),
      ]);
      expect(result.unmatchedProfileDirections).toEqual(["unsupported custom CSS"]);
      expect(result.identity).toMatchObject({
        id: "md-pdf-profile-20260704T080000Z-abc12345",
        source: "codex",
        basedOn: "md-pdf-profile-20260101T000000Z-ba5e0001",
      });
      expect(result.finalProfile).toMatchObject({
        fonts: { body: { default: "Source Serif 4" } },
        toc: { enabled: true },
      });
      await expectNoPlannedProjectArtifacts(outputPlan);
    });
  });

  test("preserves bounded page-number patches through the project profile phase", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-profile-phase-page-numbers",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nBody content.\n", "utf8");
        const basePath = join(fixtureDir, "base.yml");
        const baseYaml = [
          "pageNumbers:",
          "  enabled: true",
          "  scope: body",
          "  countFrom: body",
          "  start: 7",
          "  increment: 3",
          "  position: top-right",
          '  format: "Base {page} / {pages}"',
          "header:",
          '  left: "Stable header"',
          "  style:",
          '    fontSize: "9pt"',
          '    color: "#123456"',
          "    separator:",
          '      width: "0.75pt"',
          "      style: solid",
          '      color: "#654321"',
          '      gap: "1.5mm"',
          "footer:",
          '  right: "Stable footer"',
          "  style:",
          "    fontWeight: 600",
          "",
        ].join("\n");
        await writeFile(basePath, baseYaml, "utf8");
        let capturedFacts: Record<string, unknown> = {};

        const { outputPlan, result } = await runProfilePhaseFixture(fixtureDir, {
          baseProfile: "base.yml",
          input: "report.md",
          intent: "Use body page numbering from zero",
          profileCodexRunner: async ({ prompt }) => {
            capturedFacts = profilePromptFacts(prompt);
            return JSON.stringify({
              decision_mode: "adapted",
              selected_candidate_id: "base-profile",
              accepted_patches: [
                { op: "replace", path: "/pageNumbers/enabled", value: false },
                { op: "replace", path: "/pageNumbers/start", value: 0 },
                { op: "replace", path: "/footer/style/separator/gap", value: 0 },
              ],
              accepted_font_patches: [],
              reasoning: "Apply the bounded reusable page-number profile fields.",
              warnings: [],
              fallback_reason: "",
              unmatched_directions: [],
            });
          },
        });

        expect(result.finalProfile.pageNumbers).toMatchObject({
          countFrom: "body",
          enabled: false,
          format: "Base {page} / {pages}",
          increment: 3,
          position: "top-right",
          scope: "body",
          start: 0,
        });
        expect(result.finalProfile.header).toEqual({
          left: "Stable header",
          style: {
            color: "#123456",
            fontSize: "9pt",
            separator: {
              color: "#654321",
              gap: "1.5mm",
              style: "solid",
              width: "0.75pt",
            },
          },
        });
        expect(result.finalProfile.footer).toEqual({
          right: "Stable footer",
          style: { fontWeight: 600, separator: { gap: 0 } },
        });
        expect((result.finalProfile.pageNumbers as Record<string, unknown>).style).toBeUndefined();
        expect(result.serializedProfile).toContain("start: 0");
        expect(capturedFacts).toHaveProperty("pageNumberContract");
        expect(capturedFacts).toHaveProperty("patchValueConstraints");

        const revisedOrigin = await runProfilePhaseFixture(fixtureDir, {
          baseProfile: "base.yml",
          input: "report.md",
          intent: "Count body page numbers from the document origin",
          profileCodexRunner: async () =>
            JSON.stringify({
              decision_mode: "adapted",
              selected_candidate_id: "base-profile",
              accepted_patches: [
                { op: "replace", path: "/pageNumbers/countFrom", value: "document" },
              ],
              accepted_font_patches: [],
              reasoning: "Revise only the page-number count origin.",
              warnings: [],
              fallback_reason: "",
              unmatched_directions: [],
            }),
        });
        expect(revisedOrigin.result.finalProfile.pageNumbers).toEqual({
          countFrom: "document",
          enabled: true,
          format: "Base {page} / {pages}",
          increment: 3,
          position: "top-right",
          scope: "body",
          start: 7,
        });
        expect(await readFile(basePath, "utf8")).toBe(baseYaml);
        await expectNoPlannedProjectArtifacts(outputPlan);
        await expectNoPlannedProjectArtifacts(revisedOrigin.outputPlan);
      },
    );
  });

  test("preserves omitted false and zero values from the authoritative base profile", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-profile-phase-authoritative-base-omission",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nBody content.\n", "utf8");
        const basePath = join(fixtureDir, "base.yml");
        const baseYaml = [
          "pageNumbers:",
          "  enabled: false",
          "  scope: body",
          "  countFrom: document",
          "  start: 0",
          "  increment: 3",
          "footer:",
          "  style:",
          "    separator:",
          "      gap: 0",
          "",
        ].join("\n");
        await writeFile(basePath, baseYaml, "utf8");

        const { outputPlan, result } = await runProfilePhaseFixture(fixtureDir, {
          baseProfile: "base.yml",
          input: "report.md",
          intent: "Move the page-number label without changing its values",
          profileCodexRunner: async () =>
            JSON.stringify({
              decision_mode: "adapted",
              selected_candidate_id: "base-profile",
              accepted_patches: [
                { op: "replace", path: "/pageNumbers/position", value: "top-right" },
              ],
              accepted_font_patches: [],
              reasoning: "Revise only the page-number position.",
              warnings: [],
              fallback_reason: "",
              unmatched_directions: [],
            }),
        });

        expect(result.finalProfile.pageNumbers).toEqual({
          countFrom: "document",
          enabled: false,
          increment: 3,
          position: "top-right",
          scope: "body",
          start: 0,
        });
        expect(result.finalProfile.footer).toEqual({ style: { separator: { gap: 0 } } });
        expect(result.serializedProfile).toContain("enabled: false");
        expect(result.serializedProfile).toContain("start: 0");
        expect(result.serializedProfile).toContain("gap: 0");
        expect(await readFile(basePath, "utf8")).toBe(baseYaml);
        await expectNoPlannedProjectArtifacts(outputPlan);
      },
    );
  });

  test("rejects non-base selection and invalid bounded patches when a base profile is present", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-authoritative-base-profile",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nBody content.\n", "utf8");
        await writeFile(
          join(fixtureDir, "base.yml"),
          "pageNumbers:\n  enabled: true\n  scope: body\n  countFrom: document\n  start: 1\n  increment: 2\n",
          "utf8",
        );
        const invalidDecisions = [
          {
            expectedCode: "MARKDOWN_PDF_PROJECT_PROFILE_INVALID",
            name: "non-base candidate",
            selectedCandidateId: "wide-table",
            patches: [],
          },
          {
            expectedCode: "MARKDOWN_PDF_PROJECT_PROFILE_CODEX_FAILED",
            name: "null patch",
            selectedCandidateId: "base-profile",
            patches: [{ op: "replace", path: "/pageNumbers/enabled", value: null }],
          },
          {
            expectedCode: "MARKDOWN_PDF_PROJECT_PROFILE_CODEX_FAILED",
            name: "unknown patch",
            selectedCandidateId: "base-profile",
            patches: [{ op: "replace", path: "/pageNumbers/unknown", value: true }],
          },
          {
            expectedCode: "MARKDOWN_PDF_PROJECT_PROFILE_INVALID",
            name: "invalid patch value",
            selectedCandidateId: "base-profile",
            patches: [{ op: "replace", path: "/pageNumbers/increment", value: 0 }],
          },
        ];

        for (const invalidDecision of invalidDecisions) {
          const { runtime } = createActionTestRuntime({
            cwd: fixtureDir,
            now: () => new Date("2026-07-04T08:00:00.000Z"),
          });
          const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
            baseProfile: "base.yml",
            input: "report.md",
          });
          const signals = await collectMdPdfProjectCodexSignals(runtime, state);
          const outputPlan = await planMdPdfProjectCodexOutput({
            identityUidFactory: () => "abc12345",
            runtime,
            signalMode: signals.modes.project,
            state,
          });

          await expectCliError(
            () =>
              runMdPdfProjectCodexProfilePhase({
                outputPlan,
                profileCodexRunner: async () =>
                  JSON.stringify({
                    decision_mode: "adapted",
                    selected_candidate_id: invalidDecision.selectedCandidateId,
                    accepted_patches: invalidDecision.patches,
                    accepted_font_patches: [],
                    reasoning: invalidDecision.name,
                    warnings: [],
                    fallback_reason: "",
                    unmatched_directions: [],
                  }),
                runtime,
                signals,
                state,
              }),
            { code: invalidDecision.expectedCode },
          );
          await expectNoPlannedProjectArtifacts(outputPlan);
        }
      },
    );
  });

  test("keeps template-owned cover directions out of project profile leftovers", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-profile-phase-template-owned-cover",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nCover body.\n", "utf8");
        await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 1800));

        const { result } = await runProfilePhaseFixture(fixtureDir, {
          coverImage: "cover.png",
          input: "report.md",
          intent: "cover page uses the cover image first",
          profileCodexRunner: adaptedProfileRunner("article", [
            "cover image first",
            "unsupported profile detail",
          ]),
        });

        expect(result.phase).toMatchObject({
          decisionMode: "adapted",
          phase: "profile",
        });
        expect(result.unmatchedProfileDirections).toEqual(["unsupported profile detail"]);
      },
    );
  });

  test("runs the default project profile runner in the current read-only workspace", async () => {
    await withTempFixtureDir("md-pdf-project-codex-profile-phase-read-only", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nWide table.\n", "utf8");

      let capturedThreadOptions: unknown;
      let capturedRunMessages: unknown;
      let capturedRunOptions: unknown;
      let runCallCount = 0;
      const originalTimeoutDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, "timeout");
      const timeoutCalls: number[] = [];
      if (!originalTimeoutDescriptor || typeof originalTimeoutDescriptor.value !== "function") {
        throw new Error("AbortSignal.timeout is not available");
      }
      const originalTimeout = originalTimeoutDescriptor.value as typeof AbortSignal.timeout;
      Object.defineProperty(AbortSignal, "timeout", {
        ...originalTimeoutDescriptor,
        value: (milliseconds: number) => {
          timeoutCalls.push(milliseconds);
          return originalTimeout.call(AbortSignal, milliseconds);
        },
      });
      mock.module("@openai/codex-sdk", () => ({
        Codex: class {
          startThread(options: unknown) {
            capturedThreadOptions = options;
            return {
              run: async (messages: unknown, options: unknown) => {
                runCallCount += 1;
                capturedRunMessages = messages;
                capturedRunOptions = options;
                return {
                  finalResponse: JSON.stringify({
                    decision_mode: "adapted",
                    selected_candidate_id: "wide-table",
                    accepted_patches: [],
                    accepted_font_patches: [],
                    reasoning: "Wide table candidate matches the document facts.",
                    warnings: [],
                    fallback_reason: "",
                    unmatched_directions: [],
                  }),
                };
              },
            };
          }
        },
      }));

      let result: Awaited<ReturnType<typeof runProfilePhaseFixture>>["result"];
      try {
        result = (
          await runProfilePhaseFixture(fixtureDir, {
            input: "report.md",
            intent: "wide table report",
          })
        ).result;
      } finally {
        Object.defineProperty(AbortSignal, "timeout", originalTimeoutDescriptor);
      }

      const threadOptions = capturedThreadOptions as {
        approvalPolicy: string;
        modelReasoningEffort: string;
        networkAccessEnabled: boolean;
        sandboxMode: string;
        webSearchMode: string;
        workingDirectory: string;
      };
      const runMessages = capturedRunMessages as Array<{ text: string; type: string }>;
      const runOptions = capturedRunOptions as { outputSchema: unknown; signal: AbortSignal };
      const facts = profilePromptFacts(runMessages[0]?.text ?? "");
      expect(result.phase.decisionMode).toBe("adapted");
      expect(runCallCount).toBe(1);
      expect(threadOptions).toMatchObject({
        approvalPolicy: "never",
        modelReasoningEffort: "low",
        networkAccessEnabled: true,
        sandboxMode: "read-only",
        webSearchMode: "disabled",
      });
      expect(threadOptions.workingDirectory).toBe(fixtureDir);
      expect(runMessages).toEqual([
        expect.objectContaining({
          text: expect.stringContaining("Deterministic facts:"),
          type: "text",
        }),
      ]);
      expect(runOptions.outputSchema).toBe(MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA);
      expect(runOptions.signal).toBeInstanceOf(AbortSignal);
      expect(timeoutCalls).toEqual([MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS]);
      expect(facts).toMatchObject({
        intent: "wide table report",
        signalMode: "document-informed",
      });
      expect(facts).not.toHaveProperty("selectedBaseProfileSummary");
      expect(candidateSummaryIds(facts)).toEqual([
        "default",
        "article",
        "report",
        "wide-table",
        "compact",
        "reader",
      ]);
      expect(facts.documentSignals).toMatchObject({
        available: true,
      });
    });
  });

  test("runs the default project profile runner with base-profile facts in the current read-only workspace", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-profile-phase-read-only-base-profile",
      async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "base.yml"),
          "profile:\n  id: md-pdf-profile-20260101T000000Z-ba5e0001\n  source: deterministic\n  createdAt: 2026-01-01T00:00:00Z\npage:\n  size: Letter\nfonts:\n  body:\n    default: Source Serif 4\n",
          "utf8",
        );
        await writeFile(
          join(fixtureDir, "report.md"),
          "# Report\n\n| A | B | C |\n| - | - | - |\n| 1 | 2 | 3 |\n",
          "utf8",
        );

        let capturedThreadOptions: unknown;
        let capturedRunMessages: unknown;
        mock.module("@openai/codex-sdk", () => ({
          Codex: class {
            startThread(options: unknown) {
              capturedThreadOptions = options;
              return {
                run: async (messages: unknown) => {
                  capturedRunMessages = messages;
                  return {
                    finalResponse: JSON.stringify({
                      decision_mode: "adapted",
                      selected_candidate_id: "base-profile",
                      accepted_patches: [{ op: "replace", path: "/toc/enabled", value: true }],
                      accepted_font_patches: [],
                      reasoning: "The base profile matches the mixed project facts.",
                      warnings: [],
                      fallback_reason: "",
                      unmatched_directions: [],
                    }),
                  };
                },
              };
            }
          },
        }));

        const { outputPlan, result } = await runProfilePhaseFixture(fixtureDir, {
          baseProfile: "base.yml",
          input: "report.md",
          intent: "wide table report",
        });

        const threadOptions = capturedThreadOptions as { workingDirectory: string };
        const runMessages = capturedRunMessages as Array<{ text: string; type: string }>;
        const facts = profilePromptFacts(runMessages[0]?.text ?? "");
        expect(result.phase).toMatchObject({
          decisionMode: "adapted",
          phase: "profile",
          signalMode: "mixed-with-base",
        });
        expect(result.identity).toMatchObject({
          basedOn: "md-pdf-profile-20260101T000000Z-ba5e0001",
          source: "codex",
        });
        expect(result.finalProfile).toMatchObject({
          fonts: { body: { default: "Source Serif 4" } },
          toc: { enabled: true },
        });
        expect(threadOptions.workingDirectory).toBe(fixtureDir);
        expect(facts).toMatchObject({
          intent: "wide table report",
          selectedBaseProfileSummary: {
            basedOn: "md-pdf-profile-20260101T000000Z-ba5e0001",
            id: "base-profile",
          },
          signalMode: "mixed-with-base",
        });
        expect(facts.fontSignals).toMatchObject({
          families: expect.arrayContaining([
            expect.objectContaining({
              family: "Source Serif 4",
              key: "default",
              role: "body",
            }),
          ]),
        });
        expect(candidateSummaryIds(facts)[0]).toBe("base-profile");
        await expectNoPlannedProjectArtifacts(outputPlan);
      },
    );
  });

  test("reports no-usable default Codex decisions without project artifacts", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-profile-phase-read-only-no-usable",
      async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "report.md"),
          "# Report\n\nUnsupported profile.\n",
          "utf8",
        );

        let capturedThreadOptions: unknown;
        let runCallCount = 0;
        mock.module("@openai/codex-sdk", () => ({
          Codex: class {
            startThread(options: unknown) {
              capturedThreadOptions = options;
              return {
                run: async () => {
                  runCallCount += 1;
                  return {
                    finalResponse: JSON.stringify({
                      decision_mode: "no-usable-profile",
                      selected_candidate_id: "none",
                      accepted_patches: [],
                      accepted_font_patches: [],
                      reasoning: "The requested profile directions are not representable.",
                      warnings: ["unsupported profile direction"],
                      fallback_reason: "No usable profile.",
                      unmatched_directions: ["unsupported custom CSS"],
                    }),
                  };
                },
              };
            }
          },
        }));

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });
        const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
          input: "report.md",
        });
        const signals = await collectMdPdfProjectCodexSignals(runtime, state);
        const outputPlan = await planMdPdfProjectCodexOutput({
          identityUidFactory: () => "abc12345",
          runtime,
          signalMode: signals.modes.project,
          state,
        });

        await expectCliError(
          () =>
            runMdPdfProjectCodexProfilePhase({
              outputPlan,
              runtime,
              signals,
              state,
            }),
          { code: "MARKDOWN_PDF_PROJECT_NO_USABLE_PROFILE" },
        );
        const threadOptions = capturedThreadOptions as {
          approvalPolicy: string;
          sandboxMode: string;
          webSearchMode: string;
          workingDirectory: string;
        };
        expect(runCallCount).toBe(1);
        expect(threadOptions).toMatchObject({
          approvalPolicy: "never",
          sandboxMode: "read-only",
          webSearchMode: "disabled",
        });
        expect(threadOptions.workingDirectory).toBe(fixtureDir);
        await expectNoPlannedProjectArtifacts(outputPlan);
      },
    );
  });

  test("preserves conservative fallback profile decisions", async () => {
    await withTempFixtureDir("md-pdf-project-codex-profile-phase-fallback", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nFallback profile.\n", "utf8");

      const { outputPlan, result } = await runProfilePhaseFixture(fixtureDir, {
        input: "report.md",
        intent: "profile with unsupported detail",
        profileCodexRunner: conservativeFallbackProfileRunner(),
      });

      expect(result.phase).toMatchObject({
        decisionMode: "conservative-fallback",
        fallbackReason: "Unsupported profile details were ignored.",
        phase: "profile",
        warnings: ["fallback warning"],
      });
      expect(result.unmatchedProfileDirections).toEqual(["unsupported profile detail"]);
      expect(result.finalProfile).toMatchObject({
        toc: { enabled: true },
      });
      await expectNoPlannedProjectArtifacts(outputPlan);
    });
  });

  test("reports structured-output setup failures without project artifacts", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-profile-phase-read-only-structured-failure",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nProfile failure.\n", "utf8");

        let capturedThreadOptions: unknown;
        mock.module("@openai/codex-sdk", () => ({
          Codex: class {
            startThread(options: unknown) {
              capturedThreadOptions = options;
              return {
                run: async () => {
                  throw new Error("invalid_request_error response_format rejected");
                },
              };
            }
          },
        }));

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });
        const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
          input: "report.md",
        });
        const signals = await collectMdPdfProjectCodexSignals(runtime, state);
        const outputPlan = await planMdPdfProjectCodexOutput({
          identityUidFactory: () => "abc12345",
          runtime,
          signalMode: signals.modes.project,
          state,
        });

        await expectCliError(
          () =>
            runMdPdfProjectCodexProfilePhase({
              outputPlan,
              runtime,
              signals,
              state,
            }),
          {
            code: "MARKDOWN_PDF_PROJECT_PROFILE_CODEX_FAILED",
            messageIncludes: "structured-output",
          },
        );
        const threadOptions = capturedThreadOptions as { workingDirectory: string };
        expect(threadOptions.workingDirectory).toBe(fixtureDir);
        await expectNoPlannedProjectArtifacts(outputPlan);
      },
    );
  });

  test("reports malformed default Codex output without project artifacts", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-profile-phase-read-only-malformed",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nProfile failure.\n", "utf8");

        let capturedThreadOptions: unknown;
        mock.module("@openai/codex-sdk", () => ({
          Codex: class {
            startThread(options: unknown) {
              capturedThreadOptions = options;
              return {
                run: async () => ({ finalResponse: "{" }),
              };
            }
          },
        }));

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });
        const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
          input: "report.md",
        });
        const signals = await collectMdPdfProjectCodexSignals(runtime, state);
        const outputPlan = await planMdPdfProjectCodexOutput({
          identityUidFactory: () => "abc12345",
          runtime,
          signalMode: signals.modes.project,
          state,
        });

        await expectCliError(
          () =>
            runMdPdfProjectCodexProfilePhase({
              outputPlan,
              runtime,
              signals,
              state,
            }),
          {
            code: "MARKDOWN_PDF_PROJECT_PROFILE_CODEX_FAILED",
            messageIncludes: "malformed",
          },
        );
        const threadOptions = capturedThreadOptions as { workingDirectory: string };
        expect(threadOptions.workingDirectory).toBe(fixtureDir);
        await expectNoPlannedProjectArtifacts(outputPlan);
      },
    );
  });

  test("reports unavailable default Codex failures without project artifacts", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-profile-phase-read-only-unavailable",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nProfile failure.\n", "utf8");

        let capturedThreadOptions: unknown;
        mock.module("@openai/codex-sdk", () => ({
          Codex: class {
            startThread(options: unknown) {
              capturedThreadOptions = options;
              return {
                run: async () => {
                  throw new Error("transport closed");
                },
              };
            }
          },
        }));

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });
        const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
          input: "report.md",
        });
        const signals = await collectMdPdfProjectCodexSignals(runtime, state);
        const outputPlan = await planMdPdfProjectCodexOutput({
          identityUidFactory: () => "abc12345",
          runtime,
          signalMode: signals.modes.project,
          state,
        });

        await expectCliError(
          () =>
            runMdPdfProjectCodexProfilePhase({
              outputPlan,
              runtime,
              signals,
              state,
            }),
          {
            code: "MARKDOWN_PDF_PROJECT_PROFILE_CODEX_FAILED",
            messageIncludes: "failed while generating",
          },
        );
        const threadOptions = capturedThreadOptions as { workingDirectory: string };
        expect(threadOptions.workingDirectory).toBe(fixtureDir);
        await expectNoPlannedProjectArtifacts(outputPlan);
      },
    );
  });

  test("reports invalid default Codex decisions without project artifacts", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-profile-phase-read-only-invalid",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nUnknown profile.\n", "utf8");

        let capturedThreadOptions: unknown;
        mock.module("@openai/codex-sdk", () => ({
          Codex: class {
            startThread(options: unknown) {
              capturedThreadOptions = options;
              return {
                run: async () => ({
                  finalResponse: JSON.stringify({
                    decision_mode: "adapted",
                    selected_candidate_id: "not-a-candidate",
                    accepted_patches: [],
                    accepted_font_patches: [],
                    reasoning: "Unknown candidate.",
                    warnings: [],
                    fallback_reason: "",
                    unmatched_directions: [],
                  }),
                }),
              };
            }
          },
        }));

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });
        const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
          input: "report.md",
        });
        const signals = await collectMdPdfProjectCodexSignals(runtime, state);
        const outputPlan = await planMdPdfProjectCodexOutput({
          identityUidFactory: () => "abc12345",
          runtime,
          signalMode: signals.modes.project,
          state,
        });

        await expectCliError(
          () =>
            runMdPdfProjectCodexProfilePhase({
              outputPlan,
              runtime,
              signals,
              state,
            }),
          { code: "MARKDOWN_PDF_PROJECT_PROFILE_INVALID" },
        );
        const threadOptions = capturedThreadOptions as { workingDirectory: string };
        expect(threadOptions.workingDirectory).toBe(fixtureDir);
        await expectNoPlannedProjectArtifacts(outputPlan);
      },
    );
  });

  test("fails injected unavailable Codex runner errors without partial profile writes", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-profile-phase-injected-unavailable",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Report\n\nUnavailable Codex.\n", "utf8");

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });
        const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
          input: "report.md",
        });
        const signals = await collectMdPdfProjectCodexSignals(runtime, state);
        const outputPlan = await planMdPdfProjectCodexOutput({
          identityUidFactory: () => "abc12345",
          runtime,
          signalMode: signals.modes.project,
          state,
        });

        await expectCliError(
          () =>
            runMdPdfProjectCodexProfilePhase({
              outputPlan,
              profileCodexRunner: async () => {
                throw new Error("transport closed");
              },
              runtime,
              signals,
              state,
            }),
          {
            code: "MARKDOWN_PDF_PROJECT_PROFILE_CODEX_FAILED",
            messageIncludes: "failed while generating",
          },
        );
        await expectNoPlannedProjectArtifacts(outputPlan);
      },
    );
  });

  test("fails injected structured-output setup errors without partial profile writes", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-profile-phase-injected-structured-failure",
      async (fixtureDir) => {
        await writeFile(
          join(fixtureDir, "report.md"),
          "# Report\n\nStructured output failure.\n",
          "utf8",
        );

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-07-04T08:00:00.000Z"),
        });
        const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
          input: "report.md",
        });
        const signals = await collectMdPdfProjectCodexSignals(runtime, state);
        const outputPlan = await planMdPdfProjectCodexOutput({
          identityUidFactory: () => "abc12345",
          runtime,
          signalMode: signals.modes.project,
          state,
        });

        await expectCliError(
          () =>
            runMdPdfProjectCodexProfilePhase({
              outputPlan,
              profileCodexRunner: async () => {
                throw new Error("invalid_request_error response_format rejected");
              },
              runtime,
              signals,
              state,
            }),
          {
            code: "MARKDOWN_PDF_PROJECT_PROFILE_CODEX_FAILED",
            messageIncludes: "structured-output",
          },
        );
        await expectNoPlannedProjectArtifacts(outputPlan);
      },
    );
  });

  test("fails invalid Codex profile decisions with the project phase error code", async () => {
    await withTempFixtureDir("md-pdf-project-codex-profile-phase-invalid", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nUnknown profile.\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T08:00:00.000Z"),
      });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        input: "report.md",
      });
      const signals = await collectMdPdfProjectCodexSignals(runtime, state);
      const outputPlan = await planMdPdfProjectCodexOutput({
        identityUidFactory: () => "abc12345",
        runtime,
        signalMode: signals.modes.project,
        state,
      });

      await expectCliError(
        () =>
          runMdPdfProjectCodexProfilePhase({
            outputPlan,
            profileCodexRunner: adaptedProfileRunner("not-a-candidate"),
            runtime,
            signals,
            state,
          }),
        { code: "MARKDOWN_PDF_PROJECT_PROFILE_INVALID" },
      );
      await expectNoPlannedProjectArtifacts(outputPlan);

      await expectCliError(
        () =>
          runMdPdfProjectCodexProfilePhase({
            outputPlan,
            profileCodexRunner: conservativeFallbackProfileRunner("not-a-candidate"),
            runtime,
            signals,
            state,
          }),
        { code: "MARKDOWN_PDF_PROJECT_PROFILE_INVALID" },
      );
      await expectNoPlannedProjectArtifacts(outputPlan);

      const invalidCountingRunner: MarkdownPdfCodexProfileRunner = async () =>
        JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "default",
          accepted_patches: [
            { op: "replace", path: "/pageNumbers/scope", value: "document" },
            { op: "replace", path: "/pageNumbers/countFrom", value: "body" },
          ],
          accepted_font_patches: [],
          reasoning: "Invalid counting combination.",
          warnings: [],
          fallback_reason: "",
          unmatched_directions: [],
        });
      await expectCliError(
        () =>
          runMdPdfProjectCodexProfilePhase({
            outputPlan,
            profileCodexRunner: invalidCountingRunner,
            runtime,
            signals,
            state,
          }),
        { code: "MARKDOWN_PDF_PROJECT_PROFILE_INVALID" },
      );
      await expectNoPlannedProjectArtifacts(outputPlan);

      const invalidStyleRunner: MarkdownPdfCodexProfileRunner = async () =>
        JSON.stringify({
          decision_mode: "adapted",
          selected_candidate_id: "default",
          accepted_patches: [{ op: "replace", path: "/header/style/fontSize", value: "13pt" }],
          accepted_font_patches: [],
          reasoning: "Invalid page chrome value.",
          warnings: [],
          fallback_reason: "",
          unmatched_directions: [],
        });
      await expectCliError(
        () =>
          runMdPdfProjectCodexProfilePhase({
            outputPlan,
            profileCodexRunner: invalidStyleRunner,
            runtime,
            signals,
            state,
          }),
        { code: "MARKDOWN_PDF_PROJECT_PROFILE_INVALID" },
      );
      await expectNoPlannedProjectArtifacts(outputPlan);
    });
  });

  test("fails no-usable profile decisions without partial profile writes", async () => {
    await withTempFixtureDir("md-pdf-project-codex-profile-phase-no-usable", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nUnsupported profile.\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T08:00:00.000Z"),
      });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        input: "report.md",
      });
      const signals = await collectMdPdfProjectCodexSignals(runtime, state);
      const outputPlan = await planMdPdfProjectCodexOutput({
        identityUidFactory: () => "abc12345",
        runtime,
        signalMode: signals.modes.project,
        state,
      });
      let runnerCallCount = 0;
      const noUsableRunner: MarkdownPdfCodexProfileRunner = async () => {
        runnerCallCount += 1;
        return noUsableProfileRunner()();
      };

      await expectCliError(
        () =>
          runMdPdfProjectCodexProfilePhase({
            outputPlan,
            profileCodexRunner: noUsableRunner,
            runtime,
            signals,
            state,
          }),
        { code: "MARKDOWN_PDF_PROJECT_NO_USABLE_PROFILE" },
      );
      expect(runnerCallCount).toBe(1);
      await expectNoPlannedProjectArtifacts(outputPlan);
    });
  });
});
