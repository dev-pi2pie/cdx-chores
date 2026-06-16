import { link, lstat, readdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { actionMdPdfProfileCodex } from "../src/cli/actions";
import { readMarkdownPdfCodexReportArtifact } from "../src/cli/markdown-pdf/codex-report";
import { readMarkdownPdfProfileFile } from "../src/cli/markdown-pdf";
import type { NormalizedMarkdownPdfProfileIdentity } from "../src/cli/markdown-pdf/profile";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

function adaptedRunner(candidateId = "wide-table") {
  return async () =>
    JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id: candidateId,
      accepted_patches: [
        { op: "replace", path: "/toc/enabled", value: true },
        { op: "replace", path: "/toc/depth", value: 2 },
      ],
      accepted_font_patches: [
        { op: "replace-font", role: "body", key: "ja", value: "Noto Serif JP" },
      ],
      reasoning: "The document has enough structure for a reusable profile.",
      warnings: [],
      fallback_reason: "",
      unmatched_directions: [],
    });
}

function allFontPatchRunner(candidateId = "default") {
  return async () =>
    JSON.stringify({
      decision_mode: "adapted",
      selected_candidate_id: candidateId,
      accepted_patches: [],
      accepted_font_patches: [
        { op: "replace-font", role: "body", key: "default", value: "Source Serif 4" },
        { op: "replace-font", role: "body", key: "ja", value: "Noto Serif JP" },
        { op: "replace-font", role: "code", key: "default", value: "JetBrains Mono" },
        { op: "replace-font", role: "code", key: "symbols", value: "Noto Sans Symbols 2" },
        { op: "replace-font", role: "heading", key: "default", value: "Inter" },
        { op: "replace-font", role: "pageChrome", key: "default", value: "Inter" },
      ],
      reasoning: "Font hints and document language signals fit dedicated font patches.",
      warnings: [],
      fallback_reason: "",
      unmatched_directions: [],
    });
}

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

  test("shows and clears TTY Codex progress on success", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-progress-success", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime, stdout, stderr } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
      await actionMdPdfProfileCodex(runtime, {
        codexRunner: adaptedRunner("article"),
        dryRun: true,
        input: "report.md",
        intent: "article profile",
        output: "profile.yml",
      });

      expect(stderr.text).toContain(
        "\r\u001b[2KRequesting Codex Markdown PDF profile recommendation... -",
      );
      expect(stderr.text).toContain(
        "\r\u001b[2KRequesting Codex Markdown PDF profile recommendation... done\n",
      );
      expect(stdout.text).toContain("Decision: adapted");
    });
  });

  test("shows and clears TTY Codex progress on errors", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-progress-error", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime, stderr } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexRunner: async () => {
              throw new Error("network unavailable");
            },
            input: "report.md",
            intent: "article profile",
            output: "profile.yml",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_FAILED",
          exitCode: 1,
          messageIncludes: "unavailable",
        },
      );

      expect(stderr.text).toContain(
        "\r\u001b[2KRequesting Codex Markdown PDF profile recommendation... -",
      );
      expect(stderr.text).toContain(
        "\r\u001b[2KRequesting Codex Markdown PDF profile recommendation... error\n",
      );
    });
  });

  test("shows fallback TTY Codex progress for conservative fallback decisions", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-progress-fallback", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime, stdout, stderr } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
      await actionMdPdfProfileCodex(runtime, {
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
        dryRun: true,
        input: "report.md",
        intent: "unclear profile",
        output: "profile.yml",
      });

      expect(stderr.text).toContain(
        "\r\u001b[2KRequesting Codex Markdown PDF profile recommendation... fallback\n",
      );
      expect(stderr.text).not.toContain(
        "\r\u001b[2KRequesting Codex Markdown PDF profile recommendation... error\n",
      );
      expect(stdout.text).toContain("Decision: conservative-fallback");
    });
  });

  test("shows one error TTY Codex progress stop for no usable profile decisions", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-progress-no-usable", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime, stderr } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexRunner: async () =>
              JSON.stringify({
                decision_mode: "no-usable-profile",
                selected_candidate_id: "none",
                accepted_patches: [],
                accepted_font_patches: [],
                reasoning: "No reusable profile fits.",
                warnings: [],
                fallback_reason: "Unsupported custom layout request.",
                unmatched_directions: ["custom layout"],
              }),
            input: "report.md",
            intent: "custom layout",
            output: "profile.yml",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_NO_USABLE_PROFILE",
          exitCode: 1,
          messageIncludes: "did not find a usable",
        },
      );

      const errorStop =
        "\r\u001b[2KRequesting Codex Markdown PDF profile recommendation... error\n";
      const errorStops = stderr.text.split(errorStop).length - 1;
      expect(errorStops).toBe(1);
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

  test("rejects conflicting positional and explicit input paths before calling Codex", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-input-conflict", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "one.md"), "# One\n", "utf8");
      await writeFile(join(fixtureDir, "two.md"), "# Two\n", "utf8");
      let codexCalls = 0;

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexRunner: async () => {
              codexCalls += 1;
              return await adaptedRunner("article")();
            },
            input: "one.md",
            output: "profile.yml",
            positionalInput: "two.md",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Positional input and --input",
        },
      );
      expect(codexCalls).toBe(0);
    });
  });

  test("allows positional and explicit input paths that resolve to the same file", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-input-same-file", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Same file\n", "utf8");
      let codexCalls = 0;

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      await actionMdPdfProfileCodex(runtime, {
        codexRunner: async () => {
          codexCalls += 1;
          return await adaptedRunner("article")();
        },
        input: "./report.md",
        output: "profile.yml",
        positionalInput: "report.md",
      });

      expect(codexCalls).toBe(1);
      const profile = await readMarkdownPdfProfileFile(join(fixtureDir, "profile.yml"));
      expect(profile.profile).toMatchObject({ preset: "article", source: "codex" });
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
      expect(await readFile(basePath, "utf8")).toBe(baseBefore);
      const derived = await readMarkdownPdfProfileFile(outputPath);
      expect(derived.profile).toMatchObject({
        basedOn: "md-pdf-profile-20260610T081500Z-a1b2c3d4",
        preset: "reader",
        source: "deterministic",
      });
      expect(derived.toc).toMatchObject({ enabled: true, depth: 3 });
      const report = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "base-only-report.json"),
      );
      expect(report.signalMode).toBe("base-only-deterministic");
      expect(report.selectedBase.candidateId).toBe("base-profile");
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

  test("stores relative report paths even when display paths are absolute", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-relative-report", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        displayPathStyle: "absolute",
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        codexReportOutput: "codex-report.json",
        codexRunner: adaptedRunner("article"),
        input: "report.md",
        intent: "article profile",
        output: "profile.yml",
      });

      const report = await readMarkdownPdfCodexReportArtifact(
        join(fixtureDir, "codex-report.json"),
      );
      expect(report.input.path).toBe("report.md");
      expect(report.profile.outputPath).toBe("profile.yml");
    });
  });

  test("rejects symlink report outputs without replacing the target profile", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-symlink", async (fixtureDir) => {
      const profilePath = join(fixtureDir, "profile.json");
      const reportAliasPath = join(fixtureDir, "alias-report.json");
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");
      await writeFile(profilePath, '{"original":true}\n', "utf8");
      await symlink(profilePath, reportAliasPath);

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "alias-report.json",
            codexRunner: adaptedRunner("article"),
            input: "report.md",
            intent: "article profile",
            output: "profile.json",
            overwrite: true,
          }),
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
          messageIncludes: "symlink",
        },
      );

      expect((await lstat(reportAliasPath)).isSymbolicLink()).toBe(true);
      expect(await readFile(profilePath, "utf8")).toBe('{"original":true}\n');
    });
  });

  test("rejects symlink and hardlink aliases between source and output artifacts", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-alias-collisions", async (fixtureDir) => {
      const profilePath = join(fixtureDir, "profile.yml");
      const inputAliasPath = join(fixtureDir, "input.md");
      const baseAliasPath = join(fixtureDir, "base-alias.yml");
      const reportInputPath = join(fixtureDir, "report-source.json");
      const reportAliasPath = join(fixtureDir, "report-alias.json");
      await writeFile(profilePath, "# Report\n", "utf8");
      await writeFile(join(fixtureDir, "shared.md"), "# Shared\n", "utf8");
      await symlink(profilePath, inputAliasPath);
      await symlink(profilePath, baseAliasPath);
      await writeFile(reportInputPath, "# JSON named Markdown\n", "utf8");
      await link(reportInputPath, reportAliasPath);
      let codexCalls = 0;

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "input.md",
            output: "profile.yml",
            overwrite: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--output cannot be the same file as Markdown input",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            baseProfile: "base-alias.yml",
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            output: "profile.yml",
            overwrite: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--output cannot be the same file as --base-profile",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            baseProfile: "shared.md",
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "shared.md",
            output: "new.yml",
            overwrite: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Markdown input cannot be the same path as --base-profile",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "report-alias.json",
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "report-source.json",
            output: "new.yml",
            overwrite: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--codex-report-output cannot be the same file as Markdown input",
        },
      );
      expect(codexCalls).toBe(0);
    });
  });

  test("rejects collisions and invalid base profiles before calling Codex", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-validation", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");
      await writeFile(join(fixtureDir, "profile.yml"), "existing", "utf8");
      await writeFile(join(fixtureDir, "codex-report.json"), "existing", "utf8");
      await writeFile(join(fixtureDir, "invalid.yml"), "unknown:\n  bad: true\n", "utf8");
      await writeFile(join(fixtureDir, "base.yml"), "toc:\n  enabled: true\n", "utf8");
      await writeFile(join(fixtureDir, "base.json"), '{"toc":{"enabled":true}}\n', "utf8");
      await writeFile(join(fixtureDir, "sample.json"), "# JSON named Markdown\n", "utf8");
      await link(join(fixtureDir, "base.yml"), join(fixtureDir, "base-input.md"));
      let codexCalls = 0;

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "report.md",
            intent: "report",
            output: "profile.yml",
          }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "already exists",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "profile.json",
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "report.md",
            intent: "report",
            output: "profile.json",
            overwrite: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "cannot be the same path",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "codex-report.yml",
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "report.md",
            intent: "report",
            output: "new.yml",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "report path must end with .json",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "sample.json",
            intent: "report",
            output: "sample.json",
            overwrite: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--output cannot be the same path as Markdown input",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "sample.json",
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "sample.json",
            intent: "report",
            output: "new.yml",
            overwrite: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--codex-report-output cannot be the same path as Markdown input",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            baseProfile: "base.yml",
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            output: "base.yml",
            overwrite: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--output cannot be the same path as --base-profile",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            baseProfile: "base.json",
            codexReportOutput: "base.json",
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            output: "new.yml",
            overwrite: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--codex-report-output cannot be the same path as --base-profile",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            baseProfile: "base.yml",
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "base-input.md",
            output: "new.yml",
            overwrite: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Markdown input cannot be the same file as --base-profile",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: "codex-report.json",
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "report.md",
            intent: "report",
            output: "new.yml",
          }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "already exists",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            baseProfile: "invalid.yml",
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "report.md",
            intent: "report",
            output: "new.yml",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unknown Markdown PDF profile key",
        },
      );
      expect(codexCalls).toBe(0);
    });
  });
});
