import {
  actionMdPdfProfileCodex,
  adaptedRunner,
  createActionTestRuntime,
  describe,
  expect,
  expectCliError,
  join,
  mkdir,
  pageNumberRunner,
  readFile,
  readMarkdownPdfCodexReportArtifact,
  readdir,
  test,
  withTempFixtureDir,
  writeFile,
} from "../profile-codex-fixtures";

describe("cli action modules: md pdf-profile codex", () => {
  test("rejects Codex reports with unsupported artifact versions", async () => {
    await withTempFixtureDir(
      "md-pdf-profile-codex-unsupported-report-version",
      async (fixtureDir) => {
        const reportPath = join(fixtureDir, "profile-report.json");

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-06-15T08:15:00.000Z"),
        });
        await actionMdPdfProfileCodex(runtime, {
          codexReportOutput: "profile-report.json",
          codexRunner: adaptedRunner("article"),
          output: "profile.yml",
        });

        const report = JSON.parse(await readFile(reportPath, "utf8")) as {
          artifact: { version: number };
        };
        report.artifact.version += 1;
        await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

        await expect(readMarkdownPdfCodexReportArtifact(reportPath)).rejects.toThrow(
          "Unsupported Markdown PDF Codex report artifact version.",
        );
      },
    );
  });

  test("rejects Codex reports with invalid signal mode", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-invalid-report-signal", async (fixtureDir) => {
      const reportPath = join(fixtureDir, "profile-report.json");
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexReportOutput: "profile-report.json",
        codexRunner: adaptedRunner("article"),
        input: "report.md",
        output: "profile.yml",
      });

      const report = JSON.parse(await readFile(reportPath, "utf8")) as Record<string, unknown>;
      report.signalMode = "missing";
      await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      await expect(readMarkdownPdfCodexReportArtifact(reportPath)).rejects.toThrow(
        "signal mode is invalid",
      );
    });
  });

  test("rejects Codex reports with inconsistent signal metadata", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-invalid-report-metadata", async (fixtureDir) => {
      const documentReportPath = join(fixtureDir, "document-report.json");
      const hintReportPath = join(fixtureDir, "hint-report.json");
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexReportOutput: "document-report.json",
        codexRunner: adaptedRunner("article"),
        input: "report.md",
        output: "profile.yml",
      });
      await actionMdPdfProfileCodex(runtime, {
        codexReportOutput: "hint-report.json",
        codexRunner: adaptedRunner("article"),
        intent: "reader profile",
        output: "hint-profile.yml",
      });

      const documentReport = JSON.parse(await readFile(documentReportPath, "utf8")) as Record<
        string,
        unknown
      >;
      documentReport.input = {};
      await writeFile(documentReportPath, `${JSON.stringify(documentReport, null, 2)}\n`, "utf8");
      await expect(readMarkdownPdfCodexReportArtifact(documentReportPath)).rejects.toThrow(
        "document-informed mode requires input metadata",
      );
      documentReport.input = { path: "report.md" };
      await writeFile(documentReportPath, `${JSON.stringify(documentReport, null, 2)}\n`, "utf8");
      await expect(readMarkdownPdfCodexReportArtifact(documentReportPath)).rejects.toThrow(
        "input metadata is incomplete",
      );
      documentReport.input = { path: "report.md", sha256: "abc" };
      documentReport.documentSignals = {
        ...(documentReport.documentSignals as object),
        available: false,
      };
      await writeFile(documentReportPath, `${JSON.stringify(documentReport, null, 2)}\n`, "utf8");
      await expect(readMarkdownPdfCodexReportArtifact(documentReportPath)).rejects.toThrow(
        "input metadata requires available document signals",
      );

      const hintReport = JSON.parse(await readFile(hintReportPath, "utf8")) as Record<
        string,
        unknown
      >;
      hintReport.input = { path: "report.md", sha256: "abc" };
      await writeFile(hintReportPath, `${JSON.stringify(hintReport, null, 2)}\n`, "utf8");
      await expect(readMarkdownPdfCodexReportArtifact(hintReportPath)).rejects.toThrow(
        "inputless signal mode cannot include input metadata",
      );
      hintReport.input = {};
      hintReport.documentSignals = { ...(hintReport.documentSignals as object), available: true };
      await writeFile(hintReportPath, `${JSON.stringify(hintReport, null, 2)}\n`, "utf8");
      await expect(readMarkdownPdfCodexReportArtifact(hintReportPath)).rejects.toThrow(
        "available document signals require input metadata",
      );
    });
  });

  test("writes a failure report for no usable profile only when requested", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-no-usable", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Unsupported\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "no-profile-report.json",
            codexRunner: async () =>
              JSON.stringify({
                decision_mode: "no-usable-profile",
                selected_candidate_id: "none",
                accepted_patches: [],
                accepted_font_patches: [],
                reasoning: "Template-only request.",
                warnings: [],
                unmatched_directions: ["custom CSS"],
              }),
            input: "report.md",
            intent: "custom CSS template",
            output: "profile.yml",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_NO_USABLE_PROFILE",
          exitCode: 1,
          messageIncludes: "did not find a usable",
        },
      );

      await expect(readFile(join(fixtureDir, "profile.yml"), "utf8")).rejects.toThrow();
      const report = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "no-profile-report.json"),
      );
      expect(report.result.status).toBe("failed");
      expect(report.result.failure).toMatchObject({ kind: "no-usable-profile" });
      expect(report.profile.identity).toMatchObject({
        basedOn: "none",
        source: "codex",
      });
      expect(report.selectedBase).toMatchObject({
        candidateId: "none",
        untracked: false,
      });
      expect(report.selectedBase.basedOn).toBeUndefined();
      expect(report.selectedBase.profileId).toBeUndefined();
      expect(report.selectedBase.path).toBeUndefined();
    });
  });

  test("writes a generated no-usable-profile report when keep report is requested", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-no-usable-keep-report", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Unsupported\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexRunner: async () =>
              JSON.stringify({
                decision_mode: "no-usable-profile",
                selected_candidate_id: "none",
                accepted_patches: [],
                accepted_font_patches: [],
                reasoning: "Template-only request.",
                warnings: [],
                unmatched_directions: ["custom CSS"],
              }),
            input: "report.md",
            intent: "custom CSS template",
            keepCodexReport: true,
            output: "profile.yml",
            profileUidFactory: () => "md-pdf-profile-20260615T081500Z-deadbeef",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_NO_USABLE_PROFILE",
          exitCode: 1,
          messageIncludes: "did not find a usable",
        },
      );

      await expect(readFile(join(fixtureDir, "profile.yml"), "utf8")).rejects.toThrow();
      const reportPath = join(
        fixtureDir,
        "profile-md-pdf-profile-20260615T081500Z-deadbeef-codex-report.json",
      );
      const report = await readMarkdownPdfCodexReportArtifact(reportPath);
      expect(report.result.status).toBe("failed");
      expect(report.result.failure).toMatchObject({ kind: "no-usable-profile" });
      expect(report.profile.identity).toMatchObject({
        id: "md-pdf-profile-20260615T081500Z-deadbeef",
        basedOn: "none",
        source: "codex",
      });
      expect(report.selectedBase).toMatchObject({
        candidateId: "none",
        untracked: false,
      });
      expect(report.selectedBase.basedOn).toBeUndefined();
      expect(report.selectedBase.profileId).toBeUndefined();
      expect(report.selectedBase.path).toBeUndefined();
    });
  });

  test("does not write a no-usable-profile report without report flags", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-no-report", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Unsupported\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexRunner: async () =>
              JSON.stringify({
                decision_mode: "no-usable-profile",
                selected_candidate_id: "none",
                accepted_patches: [],
                accepted_font_patches: [],
                reasoning: "Template-only request.",
                warnings: [],
                unmatched_directions: ["custom CSS"],
              }),
            input: "report.md",
            intent: "custom CSS template",
            output: "profile.yml",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_NO_USABLE_PROFILE",
          exitCode: 1,
        },
      );

      expect(await readdir(fixtureDir)).toEqual(["report.md"]);
    });
  });

  test("prints conservative fallback details and records fallback reports", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-fallback", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexReportOutput: "fallback-report.json",
        codexRunner: async () =>
          JSON.stringify({
            decision_mode: "conservative-fallback",
            selected_candidate_id: "default",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: "Facts are weak.",
            warnings: ["Using default profile."],
            fallback_reason: "No strong layout signal.",
            unmatched_directions: [],
          }),
        input: "report.md",
        intent: "unclear profile",
        output: "profile.yml",
      });

      expect(stdout.text).toContain("Decision: conservative-fallback");
      expect(stdout.text).toContain("Fallback reason: No strong layout signal.");
      const report = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "fallback-report.json"),
      );
      expect(report.result.fallbackReason).toBe("No strong layout signal.");
      expect(report.result.warnings).toEqual(["Using default profile."]);
    });
  });

  test("writes an unavailable failure report when requested", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-unavailable", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "codex-report.json",
            codexRunner: async () => {
              throw new Error("network unavailable");
            },
            input: "report.md",
            intent: "report",
            output: "profile.yml",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_FAILED",
          exitCode: 1,
          messageIncludes: "unavailable",
        },
      );

      const report = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "codex-report.json"),
      );
      expect(report.result.status).toBe("failed");
      expect(report.result.failure).toMatchObject({ kind: "unavailable" });
    });
  });

  test("writes a generated unavailable failure report when keep report is requested", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-unavailable-keep-report", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexRunner: async () => {
              throw new Error("network unavailable");
            },
            input: "report.md",
            intent: "report",
            keepCodexReport: true,
            output: "profile.yml",
            profileUidFactory: () => "md-pdf-profile-20260615T081500Z-deadbeef",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_FAILED",
          exitCode: 1,
          messageIncludes: "unavailable",
        },
      );

      const reportPath = join(
        fixtureDir,
        "profile-md-pdf-profile-20260615T081500Z-deadbeef-codex-report.json",
      );
      const report = await readMarkdownPdfCodexReportArtifact(reportPath);
      expect(report.result.status).toBe("failed");
      expect(report.result.failure).toMatchObject({ kind: "unavailable" });
    });
  });

  test("writes a malformed-output failure report when Codex returns invalid JSON", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-malformed", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "codex-report.json",
            codexRunner: async () => "not json",
            input: "report.md",
            intent: "report",
            output: "profile.yml",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_FAILED",
          exitCode: 1,
          messageIncludes: "invalid structured output",
        },
      );

      const report = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "codex-report.json"),
      );
      expect(report.result.status).toBe("failed");
      expect(report.result.failure).toMatchObject({ kind: "malformed-output" });
    });
  });

  test("writes structured-output and invalid-application failure reports", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-failure-kinds", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");
      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });

      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "schema-report.json",
            codexRunner: async () => {
              throw new Error("invalid_json_schema response_format");
            },
            input: "report.md",
            intent: "report",
            output: "schema-profile.yml",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_FAILED",
          exitCode: 1,
          messageIncludes: "structured output",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "invalid-application-report.json",
            codexRunner: async () =>
              JSON.stringify({
                decision_mode: "adapted",
                selected_candidate_id: "missing",
                accepted_patches: [],
                accepted_font_patches: [],
                reasoning: "bad candidate",
                warnings: [],
                unmatched_directions: [],
              }),
            input: "report.md",
            intent: "report",
            output: "invalid-application-profile.yml",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_FAILED",
          exitCode: 1,
          messageIncludes: "could not be applied",
        },
      );

      const schemaReport = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "schema-report.json"),
      );
      const invalidApplicationReport = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "invalid-application-report.json"),
      );
      expect(schemaReport.result.failure).toMatchObject({ kind: "structured-output-schema" });
      expect(invalidApplicationReport.result.failure).toMatchObject({
        kind: "invalid-application",
      });
    });
  });

  test("rejects invalid Codex patch value domains before writing the profile", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-invalid-patch-domain", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "invalid-domain-report.json",
            codexRunner: async () =>
              JSON.stringify({
                decision_mode: "adapted",
                selected_candidate_id: "default",
                accepted_patches: [{ op: "replace", path: "/cover/style", value: "modern" }],
                accepted_font_patches: [],
                reasoning: "Use a modern cover.",
                warnings: [],
                fallback_reason: "",
                unmatched_directions: [],
              }),
            input: "report.md",
            intent: "clean pdf with a proper cover page",
            output: "profile.yml",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_FAILED",
          exitCode: 1,
          messageIncludes: "/cover/style must be one of: plain, report",
        },
      );

      await expect(readFile(join(fixtureDir, "profile.yml"), "utf8")).rejects.toThrow();
      const report = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "invalid-domain-report.json"),
      );
      expect(report.result.failure).toMatchObject({ kind: "invalid-application" });
      expect(report.result.failure?.message).toContain("/cover/style");

      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "invalid-counting-report.json",
            codexRunner: async () =>
              JSON.stringify({
                decision_mode: "adapted",
                selected_candidate_id: "default",
                accepted_patches: [{ op: "replace", path: "/pageNumbers/increment", value: 0 }],
                accepted_font_patches: [],
                reasoning: "Use an invalid counting increment.",
                warnings: [],
                fallback_reason: "",
                unmatched_directions: [],
              }),
            input: "report.md",
            intent: "invalid page-number increment",
            output: "invalid-counting-profile.yml",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_FAILED",
          exitCode: 1,
          messageIncludes: "pageNumbers.increment must be a positive integer",
        },
      );
      await expect(
        readFile(join(fixtureDir, "invalid-counting-profile.yml"), "utf8"),
      ).rejects.toThrow();
      const countingReport = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "invalid-counting-report.json"),
      );
      expect(countingReport.result.failure).toMatchObject({ kind: "invalid-application" });
    });
  });

  test("reports an invalid Codex page-number origin without leaking private paths or writing a profile", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-invalid-origin-report", async (fixtureDir) => {
      const workspace = join(fixtureDir, "workspace");
      const privateInputs = join(fixtureDir, "private-inputs");
      await mkdir(workspace, { recursive: true });
      await mkdir(privateInputs, { recursive: true });
      const inputPath = join(privateInputs, "client-report.md");
      const basePath = join(privateInputs, "client-base.json");
      const outputPath = join(privateInputs, "client-profile.yml");
      await writeFile(inputPath, "# Client report\n", "utf8");
      await writeFile(
        basePath,
        `${JSON.stringify({ pageNumbers: { scope: "body", countFrom: "document" } })}\n`,
        "utf8",
      );

      const { runtime } = createActionTestRuntime({
        cwd: workspace,
        displayPathStyle: "absolute",
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      const error = await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            baseProfile: basePath,
            codexReportOutput: "failure-report.json",
            codexRunner: pageNumberRunner("base-profile", [
              { op: "replace", path: "/pageNumbers/scope", value: "document" },
              { op: "replace", path: "/pageNumbers/countFrom", value: "body" },
            ]),
            input: inputPath,
            intent: "use a conflicting page-number origin",
            output: outputPath,
          }),
        {
          code: "MARKDOWN_PDF_CODEX_FAILED",
          exitCode: 1,
          messageIncludes: "scope document cannot be used with countFrom body",
        },
      );

      expect(error.message).not.toContain(fixtureDir);
      expect(error.message).not.toContain(privateInputs);
      await expect(readFile(outputPath, "utf8")).rejects.toThrow();
      const reportPath = join(workspace, "failure-report.json");
      const report = await readMarkdownPdfCodexReportArtifact(reportPath);
      expect(report.input.path).toBe("client-report.md");
      expect(report.profile.outputPath).toBe("client-profile.yml");
      expect(report.result).toMatchObject({
        status: "failed",
        failure: {
          kind: "invalid-application",
          message: expect.stringContaining("scope document cannot be used with countFrom body"),
        },
      });
      expect(report.result.acceptedPatches).toBeUndefined();
      const rawReport = await readFile(reportPath, "utf8");
      expect(rawReport).not.toContain(fixtureDir);
      expect(rawReport).not.toContain(privateInputs);
      expect(rawReport).not.toContain("../");
    });
  });

  test("rejects invalid Codex font patch role and key combinations before writing the profile", async () => {
    for (const [name, acceptedFontPatches, messageIncludes, failureKind] of [
      [
        "invalid-role",
        [{ op: "replace-font", role: "caption", key: "default", value: "Inter" }],
        "accepted_font_patches[0].role must be one of",
        "malformed-output",
      ],
      [
        "invalid-key",
        [{ op: "replace-font", role: "code", key: "ja", value: "Inter" }],
        "accepted_font_patches[0].key must be default or symbols for code fonts",
        "invalid-application",
      ],
      [
        "invalid-heading-key",
        [{ op: "replace-font", role: "heading", key: "ja", value: "Inter" }],
        "accepted_font_patches[0].key must be default for heading fonts",
        "invalid-application",
      ],
      [
        "invalid-page-chrome-key",
        [{ op: "replace-font", role: "pageChrome", key: "zh-Hant", value: "Inter" }],
        "accepted_font_patches[0].key must be default for pageChrome fonts",
        "invalid-application",
      ],
    ] as const) {
      await withTempFixtureDir(`md-pdf-profile-codex-${name}`, async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-06-15T08:15:00.000Z"),
        });
        await expectCliError(
          () =>
            actionMdPdfProfileCodex(runtime, {
              codexReportOutput: "font-error-report.json",
              codexRunner: async () =>
                JSON.stringify({
                  decision_mode: "adapted",
                  selected_candidate_id: "default",
                  accepted_patches: [],
                  accepted_font_patches: acceptedFontPatches,
                  reasoning: "Bad font patch.",
                  warnings: [],
                  fallback_reason: "",
                  unmatched_directions: [],
                }),
              input: "report.md",
              output: "profile.yml",
            }),
          {
            code: "MARKDOWN_PDF_CODEX_FAILED",
            exitCode: 1,
            messageIncludes,
          },
        );

        await expect(readFile(join(fixtureDir, "profile.yml"), "utf8")).rejects.toThrow();
        const report = await readMarkdownPdfCodexReportArtifact(
          join(fixtureDir, "font-error-report.json"),
        );
        expect(report.result.failure).toMatchObject({ kind: failureKind });
      });
    }
  });
});
