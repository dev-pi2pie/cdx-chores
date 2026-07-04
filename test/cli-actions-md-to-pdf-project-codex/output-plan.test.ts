import { link, mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  createMdPdfProjectCodexIdentity,
  normalizeMdPdfProjectCodexCommandState,
  planMdPdfProjectCodexOutput,
} from "../../src/cli/markdown-pdf/project-codex";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";
import { minimalPng, pathExists } from "../cli-actions-md-to-pdf-template-codex/fixtures";

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
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        identityUidFactory: () => "fixed001",
      });

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
        identityUidFactory: () => "fixed001",
      });
      const plan = await planMdPdfProjectCodexOutput({
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
        identityUidFactory: () => "fixed001",
      });
      const plan = await planMdPdfProjectCodexOutput({
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
        identityUidFactory: (_now, attempt) => `retry${String(attempt).padStart(3, "0")}`,
      });
      const plan = await planMdPdfProjectCodexOutput({
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
        identityUidFactory: (_now, attempt) => `file${String(attempt).padStart(3, "0")}`,
      });
      const plan = await planMdPdfProjectCodexOutput({
        runtime,
        state,
        signalMode: "codex-assisted",
      });

      expect(plan.identity.projectBundleId).toBe(bundleIdForAttempt(1));
      expect(plan.outputDirectory).toBe(join(fixtureDir, bundleIdForAttempt(1)));
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
        identityUidFactory: (_now, attempt) => `collide${String(attempt).padStart(2, "0")}`,
      });

      await expectCliError(
        () => planMdPdfProjectCodexOutput({ runtime, state, signalMode: "codex-assisted" }),
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

  test("rejects non-empty output directories without overwrite and preserves unrelated files with overwrite", async () => {
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
      const plan = await planMdPdfProjectCodexOutput({
        runtime,
        state: overwriteState,
        signalMode: "deterministic",
      });
      expect(plan.outputDirectory).toBe(outputDirectory);
      expect(await pathExists(unrelatedPath)).toBe(true);
      expect(await pathExists(join(outputDirectory, "profile.yml"))).toBe(false);
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

  test("rejects source and sink collisions across reports, assets, and generated files", async () => {
    await withTempFixtureDir("md-pdf-project-codex-collisions", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.json");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      await writeFile(join(fixtureDir, "shared.md"), "# Shared\n", "utf8");
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
