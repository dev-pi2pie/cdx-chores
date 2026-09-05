import {
  actionMdPdfProfileCodex,
  adaptedRunner,
  allFontPatchRunner,
  createActionTestRuntime,
  describe,
  expect,
  join,
  pageNumberRunner,
  profilePromptFacts,
  readFile,
  readMarkdownPdfCodexReportArtifact,
  readMarkdownPdfProfileFile,
  test,
  withTempFixtureDir,
  writeFile,
} from "../profile-codex-fixtures";

describe("cli action modules: md pdf-profile codex", () => {
  test("accepts positional input as the Markdown sample signal", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-positional", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\nBody\n", "utf8");
      let prompt = "";

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexRunner: async (options) => {
          prompt = options.prompt;
          return await adaptedRunner("article")();
        },
        output: "profile.yml",
        positionalInput: "report.md",
      });

      expect(prompt).toContain('"signalMode": "document-informed"');
      expect(prompt).toContain('"available": true');
      const profile = await readMarkdownPdfProfileFile(join(fixtureDir, "profile.yml"));
      expect(profile.profile).toMatchObject({ source: "codex", preset: "article" });
    });
  });

  test("passes duplicate title structure to Codex and reports it without raw title text", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-title-dedup", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "report.md"),
        ["---", "title: Private Launch Plan", "---", "# Private Launch Plan", "", "Body."].join(
          "\n",
        ),
        "utf8",
      );
      let prompt = "";

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexReportOutput: "title-report.json",
        codexRunner: async (options) => {
          prompt = options.prompt;
          return JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "article",
            accepted_patches: [{ op: "replace", path: "/titleBlock/metadataTitle", value: "auto" }],
            accepted_font_patches: [],
            reasoning: "The first H1 already provides the visible title.",
            warnings: [],
            fallback_reason: "",
            unmatched_directions: [],
          });
        },
        input: "report.md",
        intent: "clean PDF without cover page",
        output: "profile.yml",
      });

      expect(prompt).toContain('"titleDecisionSignal"');
      expect(prompt).toContain('"duplicateVisibleTitleRisk": true');
      expect(prompt).toContain('"explicitNoCoverIntent": true');
      expect(prompt).toContain("/titleBlock/metadataTitle");
      expect(prompt).not.toContain("Private Launch Plan");
      const profile = await readMarkdownPdfProfileFile(join(fixtureDir, "profile.yml"));
      expect(profile.titleBlock).toEqual({ metadataTitle: "auto" });
      const report = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "title-report.json"),
      );
      expect(report.documentSignals.title).toEqual({
        frontmatterTitle: { present: true, charCount: "Private Launch Plan".length },
        firstH1: { present: true, charCount: "Private Launch Plan".length },
        normalizedTitleMatch: true,
        duplicateVisibleTitleRisk: true,
      });
      expect(report.result.acceptedPatches).toEqual([
        { op: "replace", path: "/titleBlock/metadataTitle", value: "auto" },
      ]);
      expect(JSON.stringify(report)).not.toContain("Private Launch Plan");
    });
  });

  test("runs intent-only Codex mode without recording input fingerprint fields", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-intent-only", async (fixtureDir) => {
      let prompt = "";

      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexRunner: async (options) => {
          prompt = options.prompt;
          return await adaptedRunner("reader")();
        },
        dryRun: true,
        intent: "screen reader profile",
        keepCodexReport: true,
      });

      expect(prompt).toContain('"signalMode": "hint-only"');
      expect(prompt).toContain('"available": false');
      const profileMatch = stdout.text.match(
        /Profile: (md-pdf-profile-20260615T081500Z-[a-f0-9]{8}\.yml)/,
      );
      expect(profileMatch?.[1]).toBeDefined();
      const profilePath = profileMatch?.[1] ?? "";
      const reportPath = profilePath.replace(/\.yml$/, "-codex-report.json");
      const report = await readMarkdownPdfCodexReportArtifact(join(fixtureDir, reportPath));
      expect(report.signalMode).toBe("hint-only");
      expect(report.documentSignals.available).toBe(false);
      expect(report.input.path).toBeUndefined();
      expect(report.input.sha256).toBeUndefined();
    });
  });

  test("uses non-empty font hints as hint-only target signals", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-font-hint-only", async (fixtureDir) => {
      let prompt = "";
      let codexCalls = 0;

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexRunner: async (options) => {
          codexCalls += 1;
          prompt = options.prompt;
          return await adaptedRunner("reader")();
        },
        fontHint: ["  ", "prefer Noto Serif CJK TC"],
        output: "profile.yml",
      });

      expect(codexCalls).toBe(1);
      expect(prompt).toContain('"signalMode": "hint-only"');
      expect(prompt).toContain('"fontHints": [\n    "prefer Noto Serif CJK TC"\n  ]');
    });
  });

  test("keeps document-informed signal mode when input and font hints are both present", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-input-plus-font-hint", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n\n日本語 and English.\n", "utf8");
      const fontHints = [
        "English body text should use a readable Latin serif font",
        "Japanese body text should prefer Hiragino Mincho or an equivalent Japanese Mincho serif font",
        "Traditional Chinese body text should use Noto Serif CJK TC or an equivalent Traditional Chinese serif font",
        "code blocks should use a dedicated monospace font such as JetBrains Mono",
      ];
      let prompt = "";

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexReportOutput: "report.json",
        codexRunner: async (options) => {
          prompt = options.prompt;
          return await adaptedRunner("reader")();
        },
        fontHint: ["  ", ...fontHints],
        input: "report.md",
        output: "profile.yml",
      });

      expect(prompt).toContain('"signalMode": "document-informed"');
      expect((profilePromptFacts(prompt).fontHints as string[]) ?? []).toEqual(fontHints);
      const report = await readMarkdownPdfCodexReportArtifact(join(fixtureDir, "report.json"));
      expect(report.signalMode).toBe("document-informed");
      expect(report.input.path).toBe("report.md");
      expect(report.request.fontHints).toEqual(fontHints);
    });
  });

  test("ignores blank-only font hints for deterministic fallback", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-blank-font-hints", async (fixtureDir) => {
      let codexCalls = 0;

      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexRunner: async () => {
          codexCalls += 1;
          return await adaptedRunner("reader")();
        },
        fontHint: ["  ", "\t"],
        output: "profile.yml",
      });

      expect(codexCalls).toBe(0);
      expect(stdout.text).toContain("Signal mode: basic-default");
      const profile = await readMarkdownPdfProfileFile(join(fixtureDir, "profile.yml"));
      expect(profile.profile).toMatchObject({ source: "deterministic" });
      expect(profile.pageNumbers).toEqual({
        enabled: false,
        scope: "body",
        countFrom: "document",
        start: 1,
        increment: 1,
        position: "bottom-center",
        format: "{page}",
      });
    });
  });

  test("ignores blank-only intent for deterministic fallback", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-blank-intent", async (fixtureDir) => {
      let codexCalls = 0;

      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexRunner: async () => {
          codexCalls += 1;
          return await adaptedRunner("reader")();
        },
        intent: "   ",
        output: "profile.yml",
      });

      expect(codexCalls).toBe(0);
      expect(stdout.text).toContain("Signal mode: basic-default");
      const profile = await readMarkdownPdfProfileFile(join(fixtureDir, "profile.yml"));
      expect(profile.profile).toMatchObject({ source: "deterministic" });
    });
  });

  test("derives a deterministic base profile without calling Codex for base-only mode", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-base-only", async (fixtureDir) => {
      const basePath = join(fixtureDir, "base.yml");
      const outputPath = join(fixtureDir, "derived.yml");
      await writeFile(
        basePath,
        [
          "profile:",
          "  id: md-pdf-profile-20260610T081500Z-a1b2c3d4",
          "  source: codex",
          "  basedOn: reader",
          "  preset: reader",
          "  createdAt: 2026-06-10T08:15:00Z",
          "toc:",
          "  enabled: true",
          "  depth: 3",
          "pageNumbers:",
          "  enabled: false",
          "  scope: body",
          "  countFrom: body",
          "  start: 0",
          "  increment: 3",
          "  position: top-left",
          '  format: "Page {page} of {pages}"',
          "",
        ].join("\n"),
        "utf8",
      );
      const baseBefore = await readFile(basePath, "utf8");
      let codexCalls = 0;

      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        baseProfile: "base.yml",
        codexReportOutput: "base-only-report.json",
        codexRunner: async () => {
          codexCalls += 1;
          return await adaptedRunner("base-profile")();
        },
        output: "derived.yml",
      });

      expect(codexCalls).toBe(0);
      expect(stdout.text).toContain("Signal mode: base-only-deterministic");
      expect(stdout.text).toContain(
        ["Reusable Profile page numbering:", "- Enabled: no"].join("\n"),
      );
      expect(stdout.text).not.toContain("Advisory renderer capability requirements:");
      expect(stdout.text).not.toMatch(
        /installed|readiness|diagnostic condition|diagnosticConditionId|status:/i,
      );
      expect(await readFile(basePath, "utf8")).toBe(baseBefore);
      const derived = await readMarkdownPdfProfileFile(outputPath);
      expect(derived.profile).toMatchObject({
        basedOn: "md-pdf-profile-20260610T081500Z-a1b2c3d4",
        preset: "reader",
        source: "deterministic",
      });
      expect(derived.toc).toMatchObject({ enabled: true, depth: 3 });
      expect(derived.pageNumbers).toEqual({
        enabled: false,
        scope: "body",
        countFrom: "body",
        start: 0,
        increment: 3,
        position: "top-left",
        format: "Page {page} of {pages}",
      });
      const report = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "base-only-report.json"),
      );
      expect(report.signalMode).toBe("base-only-deterministic");
      expect(report.selectedBase.candidateId).toBe("base-profile");
    });
  });

  test("records mixed-with-base signal mode for base profile refinements with target signals", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-mixed-base", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Base\n", "utf8");
      await writeFile(
        join(fixtureDir, "base.yml"),
        [
          "profile:",
          "  id: md-pdf-profile-20260610T081500Z-a1b2c3d4",
          "  source: codex",
          "  basedOn: reader",
          "  preset: reader",
          "  createdAt: 2026-06-10T08:15:00Z",
          "toc:",
          "  enabled: false",
          "",
        ].join("\n"),
        "utf8",
      );
      let prompt = "";
      let codexCalls = 0;

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        baseProfile: "base.yml",
        codexReportOutput: "mixed-report.json",
        codexRunner: async (options) => {
          codexCalls += 1;
          prompt = options.prompt;
          return await adaptedRunner("base-profile")();
        },
        input: "report.md",
        intent: "refine current profile",
        output: "adapted.yml",
      });

      expect(codexCalls).toBe(1);
      expect(prompt).toContain('"signalMode": "mixed-with-base"');
      const report = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "mixed-report.json"),
      );
      expect(report.signalMode).toBe("mixed-with-base");
      expect(report.selectedBase.candidateId).toBe("base-profile");
    });
  });

  test("does not attach a base profile path when a built-in candidate is selected", async () => {
    await withTempFixtureDir(
      "md-pdf-profile-codex-mixed-base-selects-preset",
      async (fixtureDir) => {
        await writeFile(join(fixtureDir, "report.md"), "# Base\n", "utf8");
        await writeFile(
          join(fixtureDir, "base.yml"),
          [
            "profile:",
            "  id: md-pdf-profile-20260610T081500Z-a1b2c3d4",
            "  source: codex",
            "  basedOn: reader",
            "  preset: reader",
            "  createdAt: 2026-06-10T08:15:00Z",
            "toc:",
            "  enabled: false",
            "",
          ].join("\n"),
          "utf8",
        );

        const { runtime } = createActionTestRuntime({
          cwd: fixtureDir,
          now: () => new Date("2026-06-15T08:15:00.000Z"),
        });
        await actionMdPdfProfileCodex(runtime, {
          baseProfile: "base.yml",
          codexReportOutput: "mixed-report.json",
          codexRunner: adaptedRunner("article"),
          input: "report.md",
          intent: "use a simpler article profile",
          output: "adapted.yml",
        });

        const report = await readMarkdownPdfCodexReportArtifact(
          join(fixtureDir, "mixed-report.json"),
        );
        expect(report.signalMode).toBe("mixed-with-base");
        expect(report.selectedBase.candidateId).toBe("article");
        expect(report.selectedBase.basedOn).toBe("article");
        expect(report.selectedBase.path).toBeUndefined();
        expect(report.selectedBase.untracked).toBe(false);
      },
    );
  });

  test("records mixed-with-base signal mode for base profile refinements with font hints", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-mixed-base-font-hint", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "base.yml"),
        [
          "profile:",
          "  id: md-pdf-profile-20260610T081500Z-a1b2c3d4",
          "  source: codex",
          "  basedOn: reader",
          "  preset: reader",
          "  createdAt: 2026-06-10T08:15:00Z",
          "toc:",
          "  enabled: false",
          "",
        ].join("\n"),
        "utf8",
      );
      let prompt = "";
      let codexCalls = 0;

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        baseProfile: "base.yml",
        codexReportOutput: "mixed-font-report.json",
        codexRunner: async (options) => {
          codexCalls += 1;
          prompt = options.prompt;
          return await adaptedRunner("base-profile")();
        },
        fontHint: ["prefer Noto Serif CJK TC"],
        output: "adapted.yml",
      });

      expect(codexCalls).toBe(1);
      expect(prompt).toContain('"signalMode": "mixed-with-base"');
      const report = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "mixed-font-report.json"),
      );
      expect(report.signalMode).toBe("mixed-with-base");
      expect(report.documentSignals.available).toBe(false);
      expect(report.selectedBase.candidateId).toBe("base-profile");
    });
  });

  test("uses a base profile as the strongest candidate without mutating it", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-base", async (fixtureDir) => {
      const basePath = join(fixtureDir, "base.yml");
      const outputPath = join(fixtureDir, "adapted.yml");
      await writeFile(join(fixtureDir, "report.md"), "# Base\n", "utf8");
      await writeFile(
        basePath,
        [
          "profile:",
          "  id: md-pdf-profile-20260610T081500Z-a1b2c3d4",
          "  source: codex",
          "  basedOn: reader",
          "  preset: reader",
          "  createdAt: 2026-06-10T08:15:00Z",
          "page:",
          "  size: A4",
          "  orientation: portrait",
          "toc:",
          "  enabled: false",
          "",
        ].join("\n"),
        "utf8",
      );
      const baseBefore = await readFile(basePath, "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        baseProfile: "base.yml",
        codexRunner: adaptedRunner("base-profile"),
        input: "report.md",
        intent: "refine current profile",
        output: "adapted.yml",
      });

      expect(await readFile(basePath, "utf8")).toBe(baseBefore);
      const adapted = await readMarkdownPdfProfileFile(outputPath);
      expect(adapted.profile).toMatchObject({
        basedOn: "md-pdf-profile-20260610T081500Z-a1b2c3d4",
        preset: "reader",
      });
      expect(adapted.page).toMatchObject({ size: "A4", orientation: "portrait" });
      expect(adapted.toc).toMatchObject({ enabled: true, depth: 2 });
    });
  });

  test("records untracked base profiles in the optional report", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-untracked-base", async (fixtureDir) => {
      const basePath = join(fixtureDir, "base.yml");
      const reportPath = join(fixtureDir, "report.json");
      await writeFile(join(fixtureDir, "report.md"), "# Base\n", "utf8");
      await writeFile(
        basePath,
        ["page:", "  size: A4", "  orientation: portrait", "toc:", "  enabled: false", ""].join(
          "\n",
        ),
        "utf8",
      );

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        baseProfile: "base.yml",
        codexReportOutput: "report.json",
        codexRunner: adaptedRunner("base-profile"),
        input: "report.md",
        intent: "refine current profile",
        output: "adapted.yml",
      });

      const report = await readMarkdownPdfCodexReportArtifact(reportPath);
      expect(report.selectedBase).toMatchObject({
        basedOn: "untracked-base-profile",
        candidateId: "base-profile",
        path: "base.yml",
        untracked: true,
      });
    });
  });

  test("preserves bounded page-number configuration and leaves the base profile immutable", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-page-number-contract", async (fixtureDir) => {
      const basePath = join(fixtureDir, "base.yml");
      const baseYaml = [
        "pageNumbers:",
        "  enabled: false",
        "  scope: body",
        "header:",
        "  left: Base header",
        "",
      ].join("\n");
      await writeFile(basePath, baseYaml, "utf8");

      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        baseProfile: "base.yml",
        codexRunner: async () =>
          JSON.stringify({
            decision_mode: "adapted",
            selected_candidate_id: "base-profile",
            accepted_patches: [
              { op: "replace", path: "/pageNumbers/enabled", value: true },
              { op: "replace", path: "/pageNumbers/countFrom", value: "body" },
              { op: "replace", path: "/pageNumbers/start", value: 0 },
              { op: "replace", path: "/pageNumbers/increment", value: 2 },
              { op: "replace", path: "/pageNumbers/position", value: "top-right" },
              { op: "replace", path: "/pageNumbers/format", value: "{page} / {pages}" },
              { op: "replace", path: "/header/style/fontSize", value: "8.5pt" },
              { op: "replace", path: "/header/style/separator/gap", value: 0 },
              { op: "replace", path: "/footer/style/fontWeight", value: 600 },
              { op: "replace", path: "/footer/style/separator/style", value: "solid" },
            ],
            accepted_font_patches: [],
            reasoning: "Use the requested bounded page-number configuration.",
            warnings: [],
            fallback_reason: "",
            unmatched_directions: [],
          }),
        intent: "Add bounded body page numbering",
        output: "profile.yml",
      });

      const profile = await readMarkdownPdfProfileFile(join(fixtureDir, "profile.yml"));
      expect(profile.pageNumbers).toEqual({
        enabled: true,
        countFrom: "body",
        format: "{page} / {pages}",
        increment: 2,
        position: "top-right",
        scope: "body",
        start: 0,
      });
      expect(profile.header).toEqual({
        left: "Base header",
        style: { fontSize: "8.5pt", separator: { gap: 0 } },
      });
      expect(profile.footer).toEqual({
        style: { fontWeight: 600, separator: { style: "solid" } },
      });
      expect((profile.pageNumbers as Record<string, unknown>).style).toBeUndefined();
      expect(stdout.text).toContain(
        [
          "Reusable Profile repeating page content:",
          '- Header: left="Base header", center="", right=""',
          "- Header style: fontSize=8.5pt, fontWeight=default, lineHeight=default, color=default",
          "- Header separator: width=default, style=default, color=default, gap=0",
          '- Footer: left="", center="", right=""',
          "- Footer style: fontSize=default, fontWeight=600, lineHeight=default, color=default",
          "- Footer separator: width=default, style=solid, color=default, gap=default",
        ].join("\n"),
      );
      expect(stdout.text).toContain("- capabilityId: pageChrome.fontSize");
      expect(stdout.text).toContain("  requestedBy: header.style.fontSize");
      expect(stdout.text).toContain("- capabilityId: pageChrome.separator.gap");
      expect(stdout.text).toContain("  requestedBy: header.style.separator.gap");
      expect(stdout.text).not.toMatch(
        /installed|readiness|diagnostic condition|diagnosticConditionId|status:/i,
      );
      expect(await readFile(basePath, "utf8")).toBe(baseYaml);
    });
  });

  test("loads a JSON base profile and preserves or revises page-number values in JSON and YAML", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-json-base", async (fixtureDir) => {
      const basePath = join(fixtureDir, "base.json");
      const baseProfile = {
        pageNumbers: {
          enabled: false,
          scope: "body",
          countFrom: "document",
          start: 0,
          increment: 3,
          position: "bottom-left",
          format: "Base {page} / {pages}",
        },
        header: {
          left: "Stable heading",
          style: { fontSize: "9pt", separator: { gap: 0 } },
        },
      };
      const baseJson = `${JSON.stringify(baseProfile, null, 2)}\n`;
      await writeFile(basePath, baseJson, "utf8");
      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });

      await actionMdPdfProfileCodex(runtime, {
        baseProfile: "base.json",
        codexRunner: pageNumberRunner("base-profile", [
          { op: "replace", path: "/pageNumbers/enabled", value: true },
          { op: "replace", path: "/pageNumbers/countFrom", value: "body" },
        ]),
        intent: "enable body-origin page numbers",
        output: "revised.json",
      });
      await actionMdPdfProfileCodex(runtime, {
        baseProfile: "base.json",
        codexRunner: pageNumberRunner("base-profile", [
          { op: "replace", path: "/pageNumbers/increment", value: 4 },
          { op: "replace", path: "/pageNumbers/position", value: "top-center" },
        ]),
        intent: "move and increment page numbers while keeping other values",
        output: "revised.yml",
      });

      const jsonProfile = await readMarkdownPdfProfileFile(join(fixtureDir, "revised.json"));
      expect(jsonProfile.pageNumbers).toEqual({
        enabled: true,
        scope: "body",
        countFrom: "body",
        start: 0,
        increment: 3,
        position: "bottom-left",
        format: "Base {page} / {pages}",
      });
      expect(jsonProfile.header).toEqual(baseProfile.header);

      const yamlProfile = await readMarkdownPdfProfileFile(join(fixtureDir, "revised.yml"));
      expect(yamlProfile.pageNumbers).toEqual({
        enabled: false,
        scope: "body",
        countFrom: "document",
        start: 0,
        increment: 4,
        position: "top-center",
        format: "Base {page} / {pages}",
      });
      expect(yamlProfile.header).toEqual(baseProfile.header);
      expect(await readFile(join(fixtureDir, "revised.yml"), "utf8")).toContain("  start: 0");
      expect(await readFile(basePath, "utf8")).toBe(baseJson);
    });
  });

  test("writes dedicated font patches as normal profile fonts and report decisions", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-font-patches", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "mixed.md");
      const outputPath = join(fixtureDir, "profile.yml");
      const reportPath = join(fixtureDir, "font-report.json");
      await writeFile(
        inputPath,
        "# Mixed\n\nEnglish and 日本語.\n\n```ts\nconst ok = true;\n```\n",
        "utf8",
      );

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexReportOutput: "font-report.json",
        codexRunner: allFontPatchRunner(),
        fontHint: ["Source Serif 4 for body, JetBrains Mono for code, Noto for Japanese"],
        input: "mixed.md",
        output: "profile.yml",
      });

      const profile = await readMarkdownPdfProfileFile(outputPath);
      expect(profile.fonts).toEqual({
        body: { default: "Source Serif 4", ja: "Noto Serif JP" },
        code: { default: "JetBrains Mono", symbols: "Noto Sans Symbols 2" },
        heading: { default: "Inter" },
        pageChrome: { default: "Inter" },
      });
      const report = await readMarkdownPdfCodexReportArtifact(reportPath);
      expect(report.result.acceptedPatches).toEqual([]);
      expect(report.result.acceptedFontPatches).toEqual([
        { op: "replace-font", role: "body", key: "default", value: "Source Serif 4" },
        { op: "replace-font", role: "body", key: "ja", value: "Noto Serif JP" },
        { op: "replace-font", role: "code", key: "default", value: "JetBrains Mono" },
        { op: "replace-font", role: "code", key: "symbols", value: "Noto Sans Symbols 2" },
        { op: "replace-font", role: "heading", key: "default", value: "Inter" },
        { op: "replace-font", role: "pageChrome", key: "default", value: "Inter" },
      ]);
    });
  });
});
