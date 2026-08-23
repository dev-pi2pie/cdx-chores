import { link, mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  createMdPdfProjectCodexIdentity,
  normalizeMdPdfProjectCodexCommandState,
  planMdPdfProjectCodexOutput,
  validateMdPdfProjectBundleCompleteness,
} from "../../src/cli/markdown-pdf/project-codex";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";
import { minimalPng } from "../markdown-pdf/actions/template-codex-fixtures";
import { pathExists } from "../markdown-pdf/support/path-fixtures";

describe("cli action modules: md pdf-project codex output planning", () => {
  test("generates shared project, profile, and template identities", () => {
    expect(
      createMdPdfProjectCodexIdentity({
        now: new Date("2026-07-04T01:02:03.000Z"),
        attempt: 0,
        outputDirectory: "/tmp/project",
        identityUidFactory: () => "fixed001",
      }),
    ).toEqual({
      createdAt: "2026-07-04T01:02:03Z",
      outputDirectory: "/tmp/project",
      profileId: "md-pdf-profile-20260704T010203Z-fixed001",
      projectBundleId: "md-pdf-project-20260704T010203Z-fixed001",
      templateBundleId: "md-pdf-template-20260704T010203Z-fixed001",
    });
    expect(
      createMdPdfProjectCodexIdentity({
        now: new Date("2026-07-04T01:02:03.000Z"),
        attempt: 0,
        outputDirectory: "/tmp/project",
      }).projectBundleId,
    ).toMatch(/^md-pdf-project-20260704T010203Z-[0-9a-f]{8}$/);
  });

  test("rejects output planning before project signal classification can proceed", async () => {
    await withTempFixtureDir("md-pdf-project-codex-low-signal-plan", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {});

      await expectCliError(
        () => planMdPdfProjectCodexOutput({ runtime, state, signalMode: "too-low-signal" }),
        {
          code: "MARKDOWN_PDF_PROJECT_LOW_SIGNAL",
          exitCode: 2,
          messageIncludes: "before project signal classification succeeds",
        },
      );
      expect(await pathExists(join(fixtureDir, "md-pdf-project-20260704T010203Z-fixed001"))).toBe(
        false,
      );
    });
  });

  test("plans generated fixed project outputs without input-derived directory names", async () => {
    await withTempFixtureDir("md-pdf-project-codex-generated-output", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "README.md"), "# Report\n", "utf8");
      await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T01:02:03.000Z"),
      });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        input: "README.md",
        coverImage: "cover.png",
        keepCodexReport: true,
      });
      const plan = await planMdPdfProjectCodexOutput({
        identityUidFactory: () => "fixed001",
        runtime,
        state,
        signalMode: "deterministic",
      });

      const outputDirectory = join(fixtureDir, "md-pdf-project-20260704T010203Z-fixed001");
      expect(plan).toMatchObject({
        generatedOutputDirectory: true,
        outputDirectory,
        identity: {
          createdAt: "2026-07-04T01:02:03Z",
          outputDirectory,
          profileId: "md-pdf-profile-20260704T010203Z-fixed001",
          projectBundleId: "md-pdf-project-20260704T010203Z-fixed001",
          templateBundleId: "md-pdf-template-20260704T010203Z-fixed001",
        },
        profile: {
          bundlePath: "profile.yml",
          path: join(outputDirectory, "profile.yml"),
        },
        templateHtml: {
          bundlePath: "template.html",
          path: join(outputDirectory, "template.html"),
        },
        styleCss: {
          bundlePath: "style.css",
          path: join(outputDirectory, "style.css"),
        },
        report: {
          bundlePath: "project.codex-report.json",
          location: "in-bundle",
          path: join(outputDirectory, "project.codex-report.json"),
        },
        assets: [
          {
            bundlePath: "assets/cover.png",
            path: join(outputDirectory, "assets", "cover.png"),
            role: "cover-image",
            sourceBasename: "cover.png",
            sourcePath: join(fixtureDir, "cover.png"),
          },
        ],
      });
      expect(plan.outputDirectory).not.toContain("README");
      expect(plan.outputDirectory).not.toContain(".md");
      expect(await pathExists(outputDirectory)).toBe(false);
    });
  });

  test("normalizes project cover asset bundle extensions", async () => {
    await withTempFixtureDir("md-pdf-project-codex-cover-extension", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "Cover.PNG"), minimalPng(1200, 800));
      await writeFile(join(fixtureDir, "cover-source"), minimalPng(1200, 800));

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T01:02:03.000Z"),
      });
      const uppercaseState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        coverImage: "Cover.PNG",
        output: "uppercase-project",
      });
      const extensionlessState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        coverImage: "cover-source",
        output: "extensionless-project",
      });
      const [uppercasePlan, extensionlessPlan] = await Promise.all([
        planMdPdfProjectCodexOutput({
          runtime,
          state: uppercaseState,
          signalMode: "deterministic",
        }),
        planMdPdfProjectCodexOutput({
          runtime,
          state: extensionlessState,
          signalMode: "deterministic",
        }),
      ]);

      expect(uppercasePlan.assets[0]).toMatchObject({
        bundlePath: "assets/cover.png",
        path: join(fixtureDir, "uppercase-project", "assets", "cover.png"),
        sourceBasename: "Cover.PNG",
      });
      expect(extensionlessPlan.assets[0]).toMatchObject({
        bundlePath: "assets/cover.png",
        path: join(fixtureDir, "extensionless-project", "assets", "cover.png"),
        sourceBasename: "cover-source",
      });
    });
  });

  test("uses explicit output directories and explicit report paths exactly after resolution", async () => {
    await withTempFixtureDir("md-pdf-project-codex-explicit-output", async (fixtureDir) => {
      const outputDirectory = join(fixtureDir, "reviewable-project");
      const reportPath = join(fixtureDir, "project-report.json");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T01:02:03.000Z"),
      });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        output: "reviewable-project",
        codexReportOutput: reportPath,
      });
      const plan = await planMdPdfProjectCodexOutput({
        identityUidFactory: () => "fixed001",
        runtime,
        state,
        signalMode: "deterministic",
      });

      expect(plan.generatedOutputDirectory).toBe(false);
      expect(plan.outputDirectory).toBe(outputDirectory);
      expect(plan.identity.projectBundleId).toBe("md-pdf-project-20260704T010203Z-fixed001");
      expect(plan.report).toEqual({
        location: "external",
        path: reportPath,
      });
    });
  });

  test("retries generated output paths and fails after bounded retry exhaustion", async () => {
    await withTempFixtureDir("md-pdf-project-codex-output-retry", async (fixtureDir) => {
      const bundleIdForAttempt = (attempt: number) =>
        `md-pdf-project-20260704T010203Z-retry${String(attempt).padStart(3, "0")}`;
      await mkdir(join(fixtureDir, bundleIdForAttempt(0)), { recursive: true });

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T01:02:03.000Z"),
      });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        intent: "client report",
      });
      const plan = await planMdPdfProjectCodexOutput({
        identityUidFactory: (_now, attempt) => `retry${String(attempt).padStart(3, "0")}`,
        runtime,
        state,
        signalMode: "codex-assisted",
      });

      expect(plan.identity.projectBundleId).toBe(bundleIdForAttempt(1));
      expect(plan.outputDirectory).toBe(join(fixtureDir, bundleIdForAttempt(1)));
    });

    await withTempFixtureDir("md-pdf-project-codex-output-retry-file", async (fixtureDir) => {
      const bundleIdForAttempt = (attempt: number) =>
        `md-pdf-project-20260704T010203Z-file${String(attempt).padStart(3, "0")}`;
      await writeFile(join(fixtureDir, bundleIdForAttempt(0)), "not a directory\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T01:02:03.000Z"),
      });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        intent: "client report",
      });
      const plan = await planMdPdfProjectCodexOutput({
        identityUidFactory: (_now, attempt) => `file${String(attempt).padStart(3, "0")}`,
        runtime,
        state,
        signalMode: "codex-assisted",
      });

      expect(plan.identity.projectBundleId).toBe(bundleIdForAttempt(1));
      expect(plan.outputDirectory).toBe(join(fixtureDir, bundleIdForAttempt(1)));
    });

    await withTempFixtureDir("md-pdf-project-codex-output-final-retry", async (fixtureDir) => {
      const bundleIdForAttempt = (attempt: number) =>
        `md-pdf-project-20260704T010203Z-final${String(attempt).padStart(3, "0")}`;
      for (let attempt = 0; attempt < 9; attempt += 1) {
        await mkdir(join(fixtureDir, bundleIdForAttempt(attempt)), { recursive: true });
      }

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T01:02:03.000Z"),
      });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        intent: "client report",
      });
      const plan = await planMdPdfProjectCodexOutput({
        identityUidFactory: (_now, attempt) => `final${String(attempt).padStart(3, "0")}`,
        runtime,
        state,
        signalMode: "codex-assisted",
      });

      expect(plan.identity.projectBundleId).toBe(bundleIdForAttempt(9));
      expect(plan.outputDirectory).toBe(join(fixtureDir, bundleIdForAttempt(9)));
    });

    await withTempFixtureDir("md-pdf-project-codex-output-retry-exhausted", async (fixtureDir) => {
      const bundleIdForAttempt = (attempt: number) =>
        `md-pdf-project-20260704T010203Z-collide${String(attempt).padStart(2, "0")}`;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await mkdir(join(fixtureDir, bundleIdForAttempt(attempt)), { recursive: true });
      }

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-07-04T01:02:03.000Z"),
      });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        intent: "client report",
      });

      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            identityUidFactory: (_now, attempt) => `collide${String(attempt).padStart(2, "0")}`,
            runtime,
            state,
            signalMode: "codex-assisted",
          }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "Unable to generate a non-colliding Markdown PDF project directory",
        },
      );
    });
  });

  test("rejects explicit output paths that are not directories", async () => {
    await withTempFixtureDir("md-pdf-project-codex-output-file", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "pdf-project"), "not a directory\n", "utf8");

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        output: "pdf-project",
      });

      await expectCliError(
        () => planMdPdfProjectCodexOutput({ runtime, state, signalMode: "deterministic" }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Project output path is not a directory",
        },
      );
    });
  });

  test("rejects unrelated Project entries even with overwrite", async () => {
    await withTempFixtureDir("md-pdf-project-codex-overwrite", async (fixtureDir) => {
      const outputDirectory = join(fixtureDir, "pdf-project");
      const unrelatedPath = join(outputDirectory, "unrelated.txt");
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(unrelatedPath, "keep me\n", "utf8");

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        output: "pdf-project",
      });
      await expectCliError(
        () => planMdPdfProjectCodexOutput({ runtime, state, signalMode: "deterministic" }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "Project output directory is not empty",
        },
      );

      const overwriteState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        output: "pdf-project",
        overwrite: true,
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: overwriteState,
            signalMode: "deterministic",
          }),
        {
          code: "MARKDOWN_PDF_PROJECT_BUNDLE_INCOMPLETE",
          exitCode: 2,
          messageIncludes: "Unrelated Project bundle entries:\n- unrelated.txt",
        },
      );
      expect(await pathExists(unrelatedPath)).toBe(true);
      expect(await pathExists(join(outputDirectory, "profile.yml"))).toBe(false);
    });
  });

  test("rejects nested unrelated Project assets before overwrite planning writes any role", async () => {
    await withTempFixtureDir("md-pdf-project-codex-overwrite-nested-asset", async (fixtureDir) => {
      const outputDirectory = join(fixtureDir, "pdf-project");
      const unrelatedAsset = join(outputDirectory, "assets", "notes.txt");
      await mkdir(join(outputDirectory, "assets"), { recursive: true });
      await writeFile(unrelatedAsset, "keep me\n", "utf8");

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        output: "pdf-project",
        overwrite: true,
      });
      const error = await expectCliError(
        () => planMdPdfProjectCodexOutput({ runtime, state, signalMode: "deterministic" }),
        {
          code: "MARKDOWN_PDF_PROJECT_BUNDLE_INCOMPLETE",
          exitCode: 2,
          messageIncludes: "Unrelated Project bundle entries:\n- assets/notes.txt",
        },
      );

      expect(error.message).toBe(
        [
          "Incomplete Markdown PDF Project bundle: pdf-project",
          "Unrelated Project bundle entries:\n- assets/notes.txt",
        ].join("\n\n"),
      );
      expect(await pathExists(unrelatedAsset)).toBe(true);
      expect(await pathExists(join(outputDirectory, "profile.yml"))).toBe(false);
      expect(await pathExists(join(outputDirectory, "template.html"))).toBe(false);
      expect(await pathExists(join(outputDirectory, "style.css"))).toBe(false);
    });
  });

  test("permits overwrite preflight for existing canonical roles, reports, and one managed cover", async () => {
    await withTempFixtureDir("md-pdf-project-codex-overwrite-managed", async (fixtureDir) => {
      const outputDirectory = join(fixtureDir, "pdf-project");
      await mkdir(join(outputDirectory, "assets"), { recursive: true });
      await writeFile(join(fixtureDir, "cover-source.png"), minimalPng(1200, 800));
      await writeFile(join(outputDirectory, "profile.yml"), "page: {}\n", "utf8");
      await writeFile(join(outputDirectory, "template.html"), "$body$\n", "utf8");
      await writeFile(join(outputDirectory, "style.css"), "body {}\n", "utf8");
      await writeFile(join(outputDirectory, "assets", "cover.png"), minimalPng(1200, 800));
      await writeFile(join(outputDirectory, "project.codex-report.json"), "not-json\n", "utf8");
      await writeFile(
        join(outputDirectory, "review.json"),
        `${JSON.stringify({ artifactType: "markdown-pdf-codex-project-report" })}\n`,
        "utf8",
      );

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        coverImage: "cover-source.png",
        keepCodexReport: true,
        output: "pdf-project",
        overwrite: true,
      });
      const plan = await planMdPdfProjectCodexOutput({
        runtime,
        state,
        signalMode: "deterministic",
      });

      expect(plan).toMatchObject({
        outputDirectory,
        profile: { path: join(outputDirectory, "profile.yml") },
        templateHtml: { path: join(outputDirectory, "template.html") },
        styleCss: { path: join(outputDirectory, "style.css") },
        report: { path: join(outputDirectory, "project.codex-report.json") },
        assets: [{ path: join(outputDirectory, "assets", "cover.png") }],
      });
    });
  });

  test("rejects multiple managed cover extensions with one stable sorted diagnostic", async () => {
    await withTempFixtureDir(
      "md-pdf-project-codex-overwrite-multiple-covers",
      async (fixtureDir) => {
        const outputDirectory = join(fixtureDir, "pdf-project");
        await mkdir(join(outputDirectory, "assets"), { recursive: true });
        await writeFile(join(fixtureDir, "cover-source.png"), minimalPng(1200, 800));
        await writeFile(join(outputDirectory, "assets", "cover.png"), minimalPng(1200, 800));
        await writeFile(join(outputDirectory, "assets", "cover.jpg"), "jpeg\n", "utf8");

        const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
        const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
          coverImage: "cover-source.png",
          output: "pdf-project",
          overwrite: true,
        });
        const error = await expectCliError(
          () => planMdPdfProjectCodexOutput({ runtime, state, signalMode: "deterministic" }),
          {
            code: "MARKDOWN_PDF_PROJECT_BUNDLE_INCOMPLETE",
            exitCode: 2,
            messageIncludes: "Unrelated Project bundle entries",
          },
        );

        expect(error.message).toBe(
          [
            "Incomplete Markdown PDF Project bundle: pdf-project",
            "Unrelated Project bundle entries:\n- assets/cover.jpg\n- assets/cover.png",
          ].join("\n\n"),
        );
        expect(await pathExists(join(outputDirectory, "profile.yml"))).toBe(false);
        expect(await pathExists(join(outputDirectory, "template.html"))).toBe(false);
        expect(await pathExists(join(outputDirectory, "style.css"))).toBe(false);
      },
    );
  });

  test("accepts canonical complete Project files, recognized reports, and managed assets", async () => {
    await withTempFixtureDir("md-pdf-project-codex-complete-bundle", async (fixtureDir) => {
      await mkdir(join(fixtureDir, "assets"), { recursive: true });
      await writeFile(join(fixtureDir, "profile.yml"), "page: {}\n", "utf8");
      await writeFile(join(fixtureDir, "template.html"), "$body$\n", "utf8");
      await writeFile(join(fixtureDir, "style.css"), "body {}\n", "utf8");
      await writeFile(join(fixtureDir, "assets", "cover.png"), minimalPng(1200, 800));
      await writeFile(join(fixtureDir, "project.codex-report.json"), "not-json\n", "utf8");
      await writeFile(
        join(fixtureDir, "review.json"),
        `${JSON.stringify({ artifactType: "markdown-pdf-codex-project-report" })}\n`,
        "utf8",
      );

      const result = await validateMdPdfProjectBundleCompleteness(fixtureDir);

      expect(result).toEqual({
        assets: [join(fixtureDir, "assets", "cover.png")],
        css: join(fixtureDir, "style.css"),
        directory: fixtureDir,
        profile: join(fixtureDir, "profile.yml"),
        reports: [join(fixtureDir, "project.codex-report.json"), join(fixtureDir, "review.json")],
        template: join(fixtureDir, "template.html"),
      });
    });
  });

  test.each([
    ["profile", "profile.yml"],
    ["template", "template.html"],
    ["stylesheet", "style.css"],
  ] as const)("rejects a Project missing its canonical %s", async (_role, missingBasename) => {
    await withTempFixtureDir("md-pdf-project-codex-missing-role", async (fixtureDir) => {
      const files = new Map([
        ["profile.yml", "page: {}\n"],
        ["template.html", "$body$\n"],
        ["style.css", "body {}\n"],
      ]);
      files.delete(missingBasename);
      await Promise.all(
        [...files].map(([basename, contents]) =>
          writeFile(join(fixtureDir, basename), contents, "utf8"),
        ),
      );

      await expectCliError(() => validateMdPdfProjectBundleCompleteness(fixtureDir), {
        code: "MARKDOWN_PDF_PROJECT_BUNDLE_INCOMPLETE",
        exitCode: 2,
        messageIncludes: `Missing required Project files:\n- ${missingBasename}`,
      });
    });
  });

  test("reports duplicate roles, invalid profiles, and unrelated entries deterministically", async () => {
    await withTempFixtureDir("md-pdf-project-codex-incomplete-bundle", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "profile.yml"), "page: {}\n", "utf8");
      await writeFile(join(fixtureDir, "z-profile.yml"), "toc: {}\n", "utf8");
      await writeFile(join(fixtureDir, "a-profile.json"), '{"page":{}}\n', "utf8");
      await writeFile(join(fixtureDir, "broken.yml"), "page: true\n", "utf8");
      await writeFile(join(fixtureDir, "template.html"), "$body$\n", "utf8");
      await writeFile(join(fixtureDir, "alternate.html"), "$body$\n", "utf8");
      await writeFile(join(fixtureDir, "style.css"), "body {}\n", "utf8");
      await writeFile(join(fixtureDir, "print.css"), "body {}\n", "utf8");
      await writeFile(join(fixtureDir, "z-notes.txt"), "notes\n", "utf8");
      await writeFile(join(fixtureDir, "a-data.json"), '{"rows":[]}\n', "utf8");

      const error = await expectCliError(
        () =>
          validateMdPdfProjectBundleCompleteness(fixtureDir, {
            displayDirectory: "project-output",
          }),
        {
          code: "MARKDOWN_PDF_PROJECT_BUNDLE_INCOMPLETE",
          exitCode: 2,
          messageIncludes: "Incomplete Markdown PDF Project bundle: project-output",
        },
      );

      expect(error.message).toBe(
        [
          "Incomplete Markdown PDF Project bundle: project-output",
          "Multiple Project profile candidates:\n- a-profile.json\n- profile.yml\n- z-profile.yml",
          "Multiple Project template candidates:\n- alternate.html\n- template.html",
          "Multiple Project stylesheet candidates:\n- print.css\n- style.css",
          "Invalid Project profile files:\n- broken.yml",
          "Unrelated Project bundle entries:\n- a-data.json\n- z-notes.txt",
        ].join("\n\n"),
      );
    });
  });

  test("rejects invalid canonical Profile content and unrecognized asset entries", async () => {
    await withTempFixtureDir("md-pdf-project-codex-invalid-complete-bundle", async (fixtureDir) => {
      await mkdir(join(fixtureDir, "assets"), { recursive: true });
      await writeFile(join(fixtureDir, "profile.yml"), "page: true\n", "utf8");
      await writeFile(join(fixtureDir, "template.html"), "$body$\n", "utf8");
      await writeFile(join(fixtureDir, "style.css"), "body {}\n", "utf8");
      await writeFile(join(fixtureDir, "assets", "notes.txt"), "notes\n", "utf8");

      const error = await expectCliError(() => validateMdPdfProjectBundleCompleteness(fixtureDir), {
        code: "MARKDOWN_PDF_PROJECT_BUNDLE_INCOMPLETE",
        exitCode: 2,
        messageIncludes: "Invalid Project profile files:\n- profile.yml",
      });
      expect(error.message).toContain("Unrelated Project bundle entries:\n- assets/notes.txt");
    });
  });

  test("validates actual planned output targets before writes", async () => {
    await withTempFixtureDir("md-pdf-project-codex-planned-targets", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

      const existingOutputDirectory = join(fixtureDir, "existing-target-project");
      await mkdir(existingOutputDirectory, { recursive: true });
      await writeFile(join(existingOutputDirectory, "profile.yml"), "existing profile\n", "utf8");
      const existingState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        output: "existing-target-project",
        overwrite: true,
      });
      const existingPlan = await planMdPdfProjectCodexOutput({
        runtime,
        state: existingState,
        signalMode: "deterministic",
      });
      expect(existingPlan.profile.path).toBe(join(existingOutputDirectory, "profile.yml"));
      expect(await pathExists(join(existingOutputDirectory, "profile.yml"))).toBe(true);

      const directoryOutputDirectory = join(fixtureDir, "directory-target-project");
      await mkdir(join(directoryOutputDirectory, "template.html"), { recursive: true });
      const directoryState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        output: "directory-target-project",
        overwrite: true,
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: directoryState,
            signalMode: "deterministic",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "planned template.html is a directory",
        },
      );

      const symlinkOutputDirectory = join(fixtureDir, "symlink-target-project");
      await mkdir(symlinkOutputDirectory, { recursive: true });
      await writeFile(join(fixtureDir, "target-style.css"), "body {}\n", "utf8");
      await symlink(
        join(fixtureDir, "target-style.css"),
        join(symlinkOutputDirectory, "style.css"),
      );
      const symlinkState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        output: "symlink-target-project",
        overwrite: true,
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: symlinkState,
            signalMode: "deterministic",
          }),
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
          messageIncludes: "planned style.css is a symlink",
        },
      );

      await writeFile(join(fixtureDir, "existing-report.json"), '{"existing":true}\n', "utf8");
      const reportState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        codexReportOutput: "existing-report.json",
        output: "external-report-project",
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: reportState,
            signalMode: "deterministic",
          }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "--codex-report-output already exists",
        },
      );

      await mkdir(join(fixtureDir, "report-directory.json"), { recursive: true });
      const reportDirectoryState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        codexReportOutput: "report-directory.json",
        output: "external-report-directory-project",
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: reportDirectoryState,
            signalMode: "deterministic",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--codex-report-output is a directory",
        },
      );

      await writeFile(join(fixtureDir, "report-target.json"), '{"target":true}\n', "utf8");
      await symlink(
        join(fixtureDir, "report-target.json"),
        join(fixtureDir, "report-symlink.json"),
      );
      const reportSymlinkState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        codexReportOutput: "report-symlink.json",
        output: "external-report-symlink-project",
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: reportSymlinkState,
            signalMode: "deterministic",
          }),
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
          messageIncludes: "--codex-report-output is a symlink",
        },
      );
    });
  });

  test("rejects symlink output directories", async () => {
    await withTempFixtureDir("md-pdf-project-codex-output-symlink", async (fixtureDir) => {
      const realOutputPath = join(fixtureDir, "real-output");
      const outputDirectory = join(fixtureDir, "pdf-project");
      await mkdir(realOutputPath, { recursive: true });
      await symlink(realOutputPath, outputDirectory);

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        output: "pdf-project",
        overwrite: true,
      });

      await expectCliError(
        () => planMdPdfProjectCodexOutput({ runtime, state, signalMode: "deterministic" }),
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
          messageIncludes: "Project output directory is a symlink",
        },
      );
    });
  });

  test("rejects symlink parents and unrelated hardlinks before writes", async () => {
    await withTempFixtureDir("md-pdf-project-codex-output-parent-safety", async (fixtureDir) => {
      const realOutputRoot = join(fixtureDir, "real-output-root");
      const outputRootAlias = join(fixtureDir, "output-root-alias");
      await mkdir(join(realOutputRoot, "pdf-project"), { recursive: true });
      await symlink(realOutputRoot, outputRootAlias);

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const realCwd = join(fixtureDir, "real-cwd");
      const cwdAlias = join(fixtureDir, "cwd-alias");
      await mkdir(realCwd, { recursive: true });
      await symlink(realCwd, cwdAlias);
      const { runtime: symlinkCwdRuntime } = createActionTestRuntime({ cwd: cwdAlias });
      const symlinkCwdState = await normalizeMdPdfProjectCodexCommandState(symlinkCwdRuntime, {
        output: "cwd-project",
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime: symlinkCwdRuntime,
            state: symlinkCwdState,
            signalMode: "deterministic",
          }),
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
          messageIncludes: "Project output directory parent directory is a symlink",
        },
      );

      const outputParentState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        output: "output-root-alias/pdf-project",
        overwrite: true,
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: outputParentState,
            signalMode: "deterministic",
          }),
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
          messageIncludes: "Project output directory parent directory is a symlink",
        },
      );

      const reportTargetDirectory = join(fixtureDir, "report-targets");
      const reportAliasDirectory = join(fixtureDir, "report-link");
      await mkdir(reportTargetDirectory, { recursive: true });
      await symlink(reportTargetDirectory, reportAliasDirectory);
      const reportParentState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        codexReportOutput: "report-link/project-report.json",
        output: "report-parent-project",
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: reportParentState,
            signalMode: "deterministic",
          }),
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
          messageIncludes: "--codex-report-output parent directory is a symlink",
        },
      );

      await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));
      const assetOutputDirectory = join(fixtureDir, "asset-parent-project");
      const assetTargetDirectory = join(fixtureDir, "asset-targets");
      await mkdir(assetOutputDirectory, { recursive: true });
      await mkdir(assetTargetDirectory, { recursive: true });
      await symlink(assetTargetDirectory, join(assetOutputDirectory, "assets"));
      const assetParentState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        coverImage: "cover.png",
        output: "asset-parent-project",
        overwrite: true,
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: assetParentState,
            signalMode: "deterministic",
          }),
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
          messageIncludes: "planned asset assets/cover.png parent directory is a symlink",
        },
      );

      const hardlinkOutputDirectory = join(fixtureDir, "hardlink-target-project");
      const unrelatedTargetPath = join(fixtureDir, "unrelated-profile.yml");
      await mkdir(hardlinkOutputDirectory, { recursive: true });
      await writeFile(unrelatedTargetPath, "outside profile\n", "utf8");
      await link(unrelatedTargetPath, join(hardlinkOutputDirectory, "profile.yml"));
      const hardlinkState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        output: "hardlink-target-project",
        overwrite: true,
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: hardlinkState,
            signalMode: "deterministic",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "planned profile.yml is hard-linked",
        },
      );
    });
  });

  test("rejects source and sink collisions across reports, assets, and generated files", async () => {
    await withTempFixtureDir("md-pdf-project-codex-collisions", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.json");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      await writeFile(join(fixtureDir, "shared.md"), "# Shared\n", "utf8");
      await writeFile(join(fixtureDir, "shared-source.png"), minimalPng(1200, 800));
      await symlink(join(fixtureDir, "shared-source.png"), join(fixtureDir, "cover-alias.png"));
      await mkdir(join(fixtureDir, "shared-source-directory"), { recursive: true });
      const sourceCollisionState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        input: "shared.md",
        baseProfile: "shared.md",
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: sourceCollisionState,
            signalMode: "codex-assisted",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Markdown input cannot be the same path as --base-profile",
        },
      );

      const sourceDirectoryCollisionState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        baseProfile: "shared-source-directory",
        coverImage: "shared-source-directory",
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: sourceDirectoryCollisionState,
            signalMode: "codex-assisted",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--base-profile cannot be the same path as --cover-image",
        },
      );

      const sourceAliasCollisionState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        baseProfile: "shared-source.png",
        coverImage: "cover-alias.png",
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: sourceAliasCollisionState,
            signalMode: "codex-assisted",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--base-profile cannot be the same file as --cover-image",
        },
      );

      const outputSourceCollisionState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        baseProfile: "shared-source-directory",
        output: "shared-source-directory",
        overwrite: true,
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: outputSourceCollisionState,
            signalMode: "deterministic",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--output cannot be the same path as --base-profile",
        },
      );

      const outputCoverCollisionState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        coverImage: "shared-source-directory",
        output: "shared-source-directory",
        overwrite: true,
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: outputCoverCollisionState,
            signalMode: "deterministic",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--output cannot be the same path as --cover-image",
        },
      );

      await symlink(
        join(fixtureDir, "shared-source-directory"),
        join(fixtureDir, "source-directory-alias"),
      );
      const outputCoverAliasCollisionState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        coverImage: "source-directory-alias",
        output: "shared-source-directory",
        overwrite: true,
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: outputCoverAliasCollisionState,
            signalMode: "deterministic",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--output cannot be the same file as --cover-image",
        },
      );

      const reportCollisionState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        input: "report.json",
        codexReportOutput: "report.json",
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: reportCollisionState,
            signalMode: "codex-assisted",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--codex-report-output cannot be the same path as Markdown input",
        },
      );

      await writeFile(join(fixtureDir, "base.json"), '{"profile":true}\n', "utf8");
      const reportBaseCollisionState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        baseProfile: "base.json",
        codexReportOutput: "base.json",
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: reportBaseCollisionState,
            signalMode: "deterministic",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--codex-report-output cannot be the same path as --base-profile",
        },
      );

      const outputReportCollisionState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        output: "same-output-report.json",
        codexReportOutput: "same-output-report.json",
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: outputReportCollisionState,
            signalMode: "deterministic",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--output cannot be the same path as --codex-report-output",
        },
      );

      await writeFile(join(fixtureDir, "cover-source.png"), minimalPng(1200, 800));
      for (const { coverImage, expected, output, reportFile, targetSegments } of [
        {
          expected: "planned profile.yml cannot be the same file as --codex-report-output",
          output: "report-profile-target-project",
          reportFile: "profile-report.json",
          targetSegments: ["profile.yml"],
        },
        {
          expected: "planned template.html cannot be the same file as --codex-report-output",
          output: "report-template-target-project",
          reportFile: "template-report.json",
          targetSegments: ["template.html"],
        },
        {
          expected: "planned style.css cannot be the same file as --codex-report-output",
          output: "report-style-target-project",
          reportFile: "style-report.json",
          targetSegments: ["style.css"],
        },
        {
          coverImage: "cover-source.png",
          expected:
            "--codex-report-output cannot be the same file as planned asset assets/cover.png",
          output: "report-asset-target-project",
          reportFile: "asset-report.json",
          targetSegments: ["assets", "cover.png"],
        },
      ] as const) {
        const outputDirectory = join(fixtureDir, output);
        const targetPath = join(outputDirectory, ...targetSegments);
        const reportPath = join(fixtureDir, reportFile);
        await mkdir(
          targetSegments.length > 1
            ? join(outputDirectory, targetSegments[0] ?? "")
            : outputDirectory,
          { recursive: true },
        );
        await writeFile(targetPath, "planned target\n", "utf8");
        await link(targetPath, reportPath);
        const reportTargetState = await normalizeMdPdfProjectCodexCommandState(runtime, {
          codexReportOutput: reportPath,
          coverImage,
          output,
          overwrite: true,
        });
        await expectCliError(
          () =>
            planMdPdfProjectCodexOutput({
              runtime,
              state: reportTargetState,
              signalMode: "deterministic",
            }),
          {
            code: "INVALID_INPUT",
            exitCode: 2,
            messageIncludes: expected,
          },
        );
      }

      const outputDirectory = join(fixtureDir, "pdf-project");
      const assetPath = join(outputDirectory, "assets", "cover.png");
      await mkdir(join(outputDirectory, "assets"), { recursive: true });
      await writeFile(assetPath, minimalPng(1200, 800));
      const assetCollisionState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        coverImage: assetPath,
        output: "pdf-project",
        overwrite: true,
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: assetCollisionState,
            signalMode: "deterministic",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes:
            "planned asset assets/cover.png cannot be the same path as --cover-image",
        },
      );

      const hardlinkOutputDirectory = join(fixtureDir, "hardlink-project");
      const baseProfilePath = join(fixtureDir, "base.yml");
      await mkdir(hardlinkOutputDirectory, { recursive: true });
      await writeFile(baseProfilePath, "page:\n  size: Letter\n", "utf8");
      await link(baseProfilePath, join(hardlinkOutputDirectory, "style.css"));
      const generatedFileCollisionState = await normalizeMdPdfProjectCodexCommandState(runtime, {
        baseProfile: "base.yml",
        output: "hardlink-project",
        overwrite: true,
      });
      await expectCliError(
        () =>
          planMdPdfProjectCodexOutput({
            runtime,
            state: generatedFileCollisionState,
            signalMode: "deterministic",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "planned style.css cannot be the same file as --base-profile",
        },
      );
    });
  });
});
