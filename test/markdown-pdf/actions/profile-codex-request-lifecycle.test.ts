import {
  MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA,
  MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS,
  actionMdPdfProfileCodex,
  adaptedRunner,
  afterEach,
  candidateSummaryIds,
  createActionTestRuntime,
  describe,
  expect,
  expectCliError,
  join,
  mock,
  prepareMarkdownPdfProfileCodex,
  profilePromptFacts,
  readFile,
  readMarkdownPdfCodexReportArtifact,
  readMarkdownPdfProfileFile,
  test,
  withTempFixtureDir,
  writeFile,
} from "./profile-codex-fixtures";

afterEach(() => {
  mock.restore();
});

describe("Markdown PDF Profile Codex request lifecycle", () => {
  test("forwards an injected per-request timeout through the prepared profile request", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-timeout", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nBody.\n", "utf8");
      const timeoutCalls: Array<number | undefined> = [];
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

      await actionMdPdfProfileCodex(runtime, {
        codexRunner: async (options) => {
          timeoutCalls.push(options.timeoutMs);
          return await adaptedRunner("article")();
        },
        dryRun: true,
        input: "report.md",
        intent: "Create an article profile.",
        output: "profile.yml",
        timeoutMs: 120_000,
      });

      expect(timeoutCalls).toEqual([120_000]);
    });
  });

  test("surfaces a structurally preserved profile timeout with the configured duration", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-timeout-failure", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nBody.\n", "utf8");
      const timeoutError = new Error("private transport details");
      timeoutError.name = "TimeoutError";
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

      const prepared = await prepareMarkdownPdfProfileCodex(runtime, {
        codexRunner: async () => {
          throw timeoutError;
        },
        dryRun: true,
        input: "report.md",
        intent: "Create an article profile.",
        output: "profile.yml",
        timeoutMs: 120_000,
      });

      expect(prepared.kind).toBe("failed");
      if (prepared.kind !== "failed") {
        throw new Error("Expected profile preparation to fail");
      }
      expect(prepared.failureMessage).toBe(
        "Codex Markdown PDF profile request timed out after the 2m per-attempt limit.",
      );
      expect(prepared.failureMessage).not.toContain("private transport details");
    });
  });

  test("keeps an ordinary profile abort on the existing unavailable path", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-abort-failure", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nBody.\n", "utf8");
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

      const prepared = await prepareMarkdownPdfProfileCodex(runtime, {
        codexRunner: async () => {
          throw new DOMException("request cancelled", "AbortError");
        },
        dryRun: true,
        input: "report.md",
        intent: "Create an article profile.",
        output: "profile.yml",
      });

      expect(prepared.kind).toBe("failed");
      if (prepared.kind !== "failed") {
        throw new Error("Expected profile preparation to fail");
      }
      expect(prepared.failureMessage).toBe(
        "Codex Markdown PDF profile helper is unavailable. request cancelled",
      );
      expect(prepared.failureMessage).not.toContain("timed out");
    });
  });

  test("uses the default direct Codex runner in the current read-only workspace", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-default-runner", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nDefault runner.\n", "utf8");

      let capturedCodexOptions: unknown;
      let capturedThreadOptions: unknown;
      let capturedRunMessages: unknown;
      let capturedRunOptions: unknown;
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
          constructor(options: unknown) {
            capturedCodexOptions = options;
          }

          startThread(options: unknown) {
            capturedThreadOptions = options;
            return {
              run: async (messages: unknown, options: unknown) => {
                capturedRunMessages = messages;
                capturedRunOptions = options;
                return {
                  finalResponse: JSON.stringify({
                    decision_mode: "adapted",
                    selected_candidate_id: "default",
                    accepted_patches: [{ op: "replace", path: "/toc/enabled", value: true }],
                    accepted_font_patches: [],
                    reasoning: "The default direct runner can adapt the profile.",
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

      const { runtime, stderr } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      try {
        await actionMdPdfProfileCodex(runtime, {
          codexReportOutput: "default-runner-report.json",
          input: "report.md",
          intent: "default direct runner",
          output: "profile.yml",
        });
      } finally {
        Object.defineProperty(AbortSignal, "timeout", originalTimeoutDescriptor);
      }

      const threadOptions = capturedThreadOptions as {
        approvalPolicy: string;
        networkAccessEnabled: boolean;
        sandboxMode: string;
        webSearchMode: string;
        workingDirectory: string;
      };
      expect(capturedCodexOptions).toBeUndefined();
      expect(threadOptions).toMatchObject({
        approvalPolicy: "never",
        networkAccessEnabled: true,
        sandboxMode: "read-only",
        webSearchMode: "disabled",
      });
      expect(threadOptions.workingDirectory).toBe(fixtureDir);
      const runMessages = capturedRunMessages as Array<{ text: string; type: string }>;
      const runOptions = capturedRunOptions as { outputSchema: unknown; signal: AbortSignal };
      expect(runMessages).toEqual([
        expect.objectContaining({
          text: expect.stringContaining("Deterministic facts:"),
          type: "text",
        }),
      ]);
      expect(runOptions.outputSchema).toBe(MARKDOWN_PDF_CODEX_PROFILE_OUTPUT_SCHEMA);
      expect(runOptions.signal).toBeInstanceOf(AbortSignal);
      expect(timeoutCalls).toEqual([MARKDOWN_PDF_CODEX_PROFILE_TIMEOUT_MS]);
      expect(stderr.text).toContain("Wrote Markdown PDF profile: profile.yml");
      const profile = await readMarkdownPdfProfileFile(join(fixtureDir, "profile.yml"));
      expect(profile.profile).toMatchObject({
        basedOn: "default",
        source: "codex",
      });
      expect(profile.toc).toMatchObject({ enabled: true });
      const report = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "default-runner-report.json"),
      );
      expect(report.profile.identity).toMatchObject({
        basedOn: "default",
        source: "codex",
      });
      expect(report.selectedBase).toMatchObject({
        candidateId: "default",
        untracked: false,
      });
      expect(report.selectedBase.basedOn).toBeUndefined();
      expect(report.selectedBase.profileId).toBeUndefined();
      expect(report.selectedBase.path).toBeUndefined();
    });
  });

  test("reports default direct Codex failures without writing profiles", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-default-runner-failure", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nDefault failure.\n", "utf8");

      let capturedThreadOptions: unknown;
      let runCallCount = 0;
      mock.module("@openai/codex-sdk", () => ({
        Codex: class {
          startThread(options: unknown) {
            capturedThreadOptions = options;
            return {
              run: async () => {
                runCallCount += 1;
                throw new Error("transport closed");
              },
            };
          }
        },
      }));

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "failure-report.json",
            input: "report.md",
            intent: "default direct runner failure",
            output: "profile.yml",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_FAILED",
          exitCode: 1,
          messageIncludes: "unavailable",
        },
      );

      const threadOptions = capturedThreadOptions as {
        networkAccessEnabled: boolean;
        workingDirectory: string;
      };
      expect(runCallCount).toBe(1);
      expect(threadOptions.networkAccessEnabled).toBe(true);
      expect(threadOptions.workingDirectory).toBe(fixtureDir);
      await expect(readFile(join(fixtureDir, "profile.yml"), "utf8")).rejects.toThrow();
      const report = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "failure-report.json"),
      );
      expect(report.result.status).toBe("failed");
      expect(report.result.failure).toMatchObject({ kind: "unavailable" });
    });
  });

  test("passes base-profile facts through the default direct read-only runner", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-default-runner-base", async (fixtureDir) => {
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

      let capturedRunMessages: unknown;
      mock.module("@openai/codex-sdk", () => ({
        Codex: class {
          startThread() {
            return {
              run: async (messages: unknown) => {
                capturedRunMessages = messages;
                return {
                  finalResponse: JSON.stringify({
                    decision_mode: "adapted",
                    selected_candidate_id: "base-profile",
                    accepted_patches: [{ op: "replace", path: "/toc/enabled", value: true }],
                    accepted_font_patches: [],
                    reasoning: "The base profile matches the direct read-only facts.",
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

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        baseProfile: "base.yml",
        codexReportOutput: "base-report.json",
        input: "report.md",
        intent: "wide table report",
        output: "profile.yml",
      });

      const runMessages = capturedRunMessages as Array<{ text: string; type: string }>;
      const facts = profilePromptFacts(runMessages[0]?.text ?? "");
      expect(facts).toMatchObject({
        selectedBaseProfileSummary: {
          basedOn: "md-pdf-profile-20260101T000000Z-ba5e0001",
          id: "base-profile",
        },
        signalMode: "mixed-with-base",
      });
      expect(candidateSummaryIds(facts)[0]).toBe("base-profile");
      expect(facts.fontSignals).toMatchObject({
        families: expect.arrayContaining([
          expect.objectContaining({
            family: "Source Serif 4",
            key: "default",
            role: "body",
          }),
        ]),
      });
      const profile = await readMarkdownPdfProfileFile(join(fixtureDir, "profile.yml"));
      expect(profile.profile).toMatchObject({
        basedOn: "md-pdf-profile-20260101T000000Z-ba5e0001",
        source: "codex",
      });
      expect(profile.toc).toMatchObject({ enabled: true });
      const report = await readMarkdownPdfCodexReportArtifact(join(fixtureDir, "base-report.json"));
      expect(report.selectedBase).toMatchObject({
        basedOn: "md-pdf-profile-20260101T000000Z-ba5e0001",
        candidateId: "base-profile",
      });
    });
  });
});
