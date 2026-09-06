import {
  actionMdPdfProfileCodex,
  adaptedRunner,
  createActionTestRuntime,
  describe,
  expect,
  join,
  link,
  mkdir,
  pageNumberRunner,
  readFile,
  readMarkdownPdfCodexReportArtifact,
  readMarkdownPdfProfileFile,
  readdir,
  test,
  withTempFixtureDir,
  writeFile,
} from "./fixtures";
import type { NormalizedMarkdownPdfProfileIdentity } from "./fixtures";

describe("cli action modules: md pdf-profile codex", () => {
  test("writes a generated profile with Codex identity and optional report", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "profile.yml");
      const reportPath = join(fixtureDir, "profile-report.json");
      await writeFile(
        inputPath,
        "# Report\n\n| A | B | C |\n| - | - | - |\n| 1 | 2 | 3 |\n",
        "utf8",
      );

      const { runtime, stdout, stderr } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexReportOutput: "profile-report.json",
        codexRunner: adaptedRunner(),
        input: "report.md",
        intent: "wide table report with ToC",
        output: "profile.yml",
      });

      expect(stdout.text).toContain("Decision: adapted");
      expect(stdout.text).toContain("Based on: wide-table");
      expect(stdout.text).toContain("Preset: wide-table");
      expect(stderr.text).toContain("Collecting Markdown PDF profile signals");
      expect(stderr.text).toContain("Requesting Codex Markdown PDF profile recommendation...");
      expect(stderr.text).toContain("Wrote Markdown PDF profile: profile.yml");
      const profile = await readMarkdownPdfProfileFile(outputPath);
      expect(profile.schemaVersion).toBe(3);
      const profileIdentity = profile.profile as NormalizedMarkdownPdfProfileIdentity;
      expect(profileIdentity.id).toMatch(/^md-pdf-profile-20260615T081500Z-[a-f0-9]{8}$/);
      expect(profileIdentity).toMatchObject({
        basedOn: "wide-table",
        createdAt: "2026-06-15T08:15:00Z",
        preset: "wide-table",
        source: "codex",
      });
      expect(profile.toc).toMatchObject({ enabled: true, depth: 2 });

      const report = await readMarkdownPdfCodexReportArtifact(reportPath);
      expect(report.artifact.version).toBe(4);
      expect(report.artifact.advisoryOnly).toBe(true);
      expect(report.profile.id).toBe(profileIdentity.id);
      expect(report.input.path).toBe("report.md");
      expect(report.signalMode).toBe("document-informed");
      expect(report.result.status).toBe("success");
      expect(report.result.acceptedPatches).toEqual([
        { op: "replace", path: "/toc/enabled", value: true },
        { op: "replace", path: "/toc/depth", value: 2 },
      ]);
      expect(report.result.acceptedFontPatches).toEqual([
        { op: "replace-font", role: "body", key: "ja", value: "Noto Serif JP" },
      ]);
    });
  });

  test("serializes a no-base adapted page-number profile", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-page-numbers-no-base", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "page-numbers.yml");
      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });

      await actionMdPdfProfileCodex(runtime, {
        codexRunner: pageNumberRunner(),
        intent: "number body pages from zero",
        output: "page-numbers.yml",
      });

      const serialized = await readFile(outputPath, "utf8");
      expect(serialized).toContain("pageNumbers:\n  enabled: true");
      expect(serialized).toContain("  countFrom: body");
      expect(serialized).toContain("  start: 0");
      expect(serialized).toContain("  increment: 2");
      expect(serialized).toContain("  position: top-right");
      expect(serialized).toContain("  format: Page {page} of {pages}");
      const profile = await readMarkdownPdfProfileFile(outputPath);
      expect(profile.pageNumbers).toEqual({
        enabled: true,
        scope: "body",
        countFrom: "body",
        start: 0,
        increment: 2,
        position: "top-right",
        format: "Page {page} of {pages}",
      });
      expect(profile.profile).toMatchObject({ basedOn: "default", source: "codex" });
      expect(stdout.text).toContain(
        [
          "Reusable Profile page numbering:",
          "- Enabled: yes",
          "- Scope: body",
          "- Count from: body",
          "- Start: 0",
          "- Increment: 2",
          "- Position: top-right",
          '- Label: "Page {page} of {pages}"',
        ].join("\n"),
      );
      expect(stdout.text).toContain(
        [
          "Advisory renderer capability requirements:",
          "- capabilityId: pageNumbers.start",
          "  requestedBy: pageNumbers.start",
          "  minimumVersion: 65.1",
          "- capabilityId: pageNumbers.increment",
          "  requestedBy: pageNumbers.increment",
          "  minimumVersion: 65.1",
          "- capabilityId: pageNumbers.countFrom.body",
          "  requestedBy: pageNumbers.countFrom",
          "  minimumVersion: 65.1",
        ].join("\n"),
      );
      expect(stdout.text).not.toMatch(
        /installed|readiness|diagnostic condition|diagnosticConditionId|status:/i,
      );
    });
  });

  test("escapes terminal controls in direct Profile authoring review", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-terminal-controls", async (fixtureDir) => {
      const escape = "\u001B";
      const bell = "\u0007";
      const format = `Page ${escape}]8;;https://example.invalid${bell}link${escape}]8;;${bell} {page}`;
      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });

      await actionMdPdfProfileCodex(runtime, {
        codexRunner: pageNumberRunner("default", [
          { op: "replace", path: "/pageNumbers/enabled", value: true },
          { op: "replace", path: "/pageNumbers/format", value: format },
        ]),
        intent: "safe review output",
        output: "profile.yml",
      });

      expect(stdout.text).not.toContain(escape);
      expect(stdout.text).not.toContain(bell);
      expect(stdout.text).toContain('Label: "Page \\u001b]8;;https://example.invalid\\u0007link');
    });
  });

  test("writes a generated JSON profile with Codex identity", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-json-output", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "profile.json");
      await writeFile(inputPath, "# Report\n\nUse a reusable PDF profile.\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexRunner: adaptedRunner(),
        input: "report.md",
        output: "profile.json",
      });

      const rawProfile = await readFile(outputPath, "utf8");
      expect(JSON.parse(rawProfile)).toMatchObject({
        schemaVersion: 3,
        profile: {
          basedOn: "wide-table",
          preset: "wide-table",
          source: "codex",
        },
        toc: {
          depth: 2,
          enabled: true,
        },
        pageNumbers: {
          enabled: false,
          scope: "body",
          countFrom: "document",
          start: 1,
          increment: 1,
          position: "bottom-center",
          format: "{page}",
        },
      });
      const profile = await readMarkdownPdfProfileFile(outputPath);
      expect(profile.profile).toMatchObject({
        basedOn: "wide-table",
        preset: "wide-table",
        source: "codex",
      });
    });
  });

  test("dry-run previews without writing the profile but can keep a report", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-dry-run", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "profile.yml");
      const reportPath = join(fixtureDir, "report.json");
      await writeFile(inputPath, "# Report\n\n```ts\nconst ok = true;\n```\n", "utf8");

      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexReportOutput: "report.json",
        codexRunner: adaptedRunner("article"),
        dryRun: true,
        input: "report.md",
        intent: "article with readable code",
        output: "profile.yml",
      });

      expect(stdout.text).toContain("Dry run only. No profile was written.");
      await expect(readFile(outputPath, "utf8")).rejects.toThrow();
      const report = await readMarkdownPdfCodexReportArtifact(reportPath);
      expect(report.profile.outputPath).toBe("profile.yml");
      expect(report.result.status).toBe("success");
      expect(report.result.acceptedFontPatches).toEqual([
        { op: "replace-font", role: "body", key: "ja", value: "Noto Serif JP" },
      ]);
    });
  });

  test("dry-run previews normalized page numbers and advisory requirements with a public-safe report", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-page-number-dry-run", async (fixtureDir) => {
      const workspace = join(fixtureDir, "workspace");
      const privateInputs = join(fixtureDir, "private-inputs");
      await mkdir(workspace, { recursive: true });
      await mkdir(privateInputs, { recursive: true });
      const inputPath = join(privateInputs, "client-report.md");
      const outputPath = join(privateInputs, "client-profile.yml");
      await writeFile(inputPath, "# Client report\n", "utf8");

      const { runtime, stdout } = createActionTestRuntime({
        cwd: workspace,
        displayPathStyle: "absolute",
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexReportOutput: "dry-run-report.json",
        codexRunner: pageNumberRunner(),
        dryRun: true,
        input: inputPath,
        intent: "number body pages from zero",
        output: outputPath,
      });

      expect(stdout.text).toContain(
        [
          "Reusable Profile page numbering:",
          "- Enabled: yes",
          "- Scope: body",
          "- Count from: body",
          "- Start: 0",
          "- Increment: 2",
          "- Position: top-right",
          '- Label: "Page {page} of {pages}"',
        ].join("\n"),
      );
      expect(stdout.text).toContain(
        [
          "Advisory renderer capability requirements:",
          "- capabilityId: pageNumbers.start",
          "  requestedBy: pageNumbers.start",
          "  minimumVersion: 65.1",
          "- capabilityId: pageNumbers.increment",
          "  requestedBy: pageNumbers.increment",
          "  minimumVersion: 65.1",
          "- capabilityId: pageNumbers.countFrom.body",
          "  requestedBy: pageNumbers.countFrom",
          "  minimumVersion: 65.1",
        ].join("\n"),
      );
      expect(stdout.text).toContain("Dry run only. No profile was written.");
      expect(stdout.text).not.toMatch(
        /installed|readiness|diagnostic condition|diagnosticConditionId|status:/i,
      );
      await expect(readFile(outputPath, "utf8")).rejects.toThrow();

      const reportPath = join(workspace, "dry-run-report.json");
      const report = await readMarkdownPdfCodexReportArtifact(reportPath);
      expect(report.input.path).toBe("client-report.md");
      expect(report.profile.outputPath).toBe("client-profile.yml");
      expect(report.result.acceptedPatches).toEqual([
        { op: "replace", path: "/pageNumbers/enabled", value: true },
        { op: "replace", path: "/pageNumbers/scope", value: "body" },
        { op: "replace", path: "/pageNumbers/countFrom", value: "body" },
        { op: "replace", path: "/pageNumbers/start", value: 0 },
        { op: "replace", path: "/pageNumbers/increment", value: 2 },
        { op: "replace", path: "/pageNumbers/position", value: "top-right" },
        { op: "replace", path: "/pageNumbers/format", value: "Page {page} of {pages}" },
      ]);
      const rawReport = await readFile(reportPath, "utf8");
      expect(rawReport).not.toContain(fixtureDir);
      expect(rawReport).not.toContain(privateInputs);
      expect(rawReport).not.toContain("../");
    });
  });

  test("derives profile and report paths when output is omitted", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-generated", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexRunner: adaptedRunner("reader"),
        dryRun: true,
        input: "report.md",
        intent: "reader profile",
        keepCodexReport: true,
      });

      const profileMatch = stdout.text.match(
        /Profile: (report-md-pdf-profile-20260615T081500Z-[a-f0-9]{8}\.yml)/,
      );
      expect(profileMatch?.[1]).toBeDefined();
      const profilePath = profileMatch?.[1] ?? "";
      const expectedReportPath = profilePath.replace(/\.yml$/, "-codex-report.json");
      expect(await readdir(fixtureDir)).toContain(expectedReportPath);
      await expect(readFile(join(fixtureDir, profilePath), "utf8")).rejects.toThrow();
    });
  });

  test("dry-run without report flags does not write artifacts", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-dry-run-no-report", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexRunner: adaptedRunner("article"),
        dryRun: true,
        input: "report.md",
        intent: "article profile",
        output: "profile.yml",
      });

      expect(await readdir(fixtureDir)).toEqual(["report.md"]);
    });
  });

  test("derives generated no-input paths for no-signal deterministic fallback", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-no-signal", async (fixtureDir) => {
      let codexCalls = 0;

      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexRunner: async () => {
          codexCalls += 1;
          return await adaptedRunner("default")();
        },
        dryRun: true,
        keepCodexReport: true,
      });

      expect(codexCalls).toBe(0);
      expect(stdout.text).toContain("Signal mode: basic-default");
      const profileMatch = stdout.text.match(
        /Profile: (md-pdf-profile-20260615T081500Z-[a-f0-9]{8}\.yml)/,
      );
      expect(profileMatch?.[1]).toBeDefined();
      const profilePath = profileMatch?.[1] ?? "";
      const reportPath = profilePath.replace(/\.yml$/, "-codex-report.json");
      expect(await readdir(fixtureDir)).toEqual([reportPath]);
      const report = await readMarkdownPdfCodexReportArtifact(join(fixtureDir, reportPath));
      expect(report.signalMode).toBe("basic-default");
      expect(report.input.path).toBeUndefined();
    });
  });

  test("retries generated no-input paths when the first profile name exists", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-no-input-collision", async (fixtureDir) => {
      await writeFile(
        join(fixtureDir, "md-pdf-profile-20260615T081500Z-aaaaaaaa.yml"),
        "existing",
        "utf8",
      );
      const profileIds = [
        "md-pdf-profile-20260615T081500Z-aaaaaaaa",
        "md-pdf-profile-20260615T081500Z-bbbbbbbb",
      ];

      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        dryRun: true,
        profileUidFactory: () => profileIds.shift() ?? "md-pdf-profile-20260615T081500Z-cccccccc",
      });

      expect(stdout.text).toContain("Profile: md-pdf-profile-20260615T081500Z-bbbbbbbb.yml");
    });
  });

  test("retries generated input-derived paths when the first profile name exists", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-input-collision", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");
      await writeFile(
        join(fixtureDir, "report-md-pdf-profile-20260615T081500Z-aaaaaaaa.yml"),
        "existing",
        "utf8",
      );
      const profileIds = [
        "md-pdf-profile-20260615T081500Z-aaaaaaaa",
        "md-pdf-profile-20260615T081500Z-bbbbbbbb",
      ];

      const { runtime, stdout } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexRunner: adaptedRunner("article"),
        dryRun: true,
        input: "report.md",
        profileUidFactory: () => profileIds.shift() ?? "md-pdf-profile-20260615T081500Z-cccccccc",
      });

      expect(stdout.text).toContain("Profile: report-md-pdf-profile-20260615T081500Z-bbbbbbbb.yml");
    });
  });
});
