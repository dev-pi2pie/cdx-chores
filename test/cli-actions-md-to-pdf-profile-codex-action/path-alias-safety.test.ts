import {
  actionMdPdfProfileCodex,
  adaptedRunner,
  createActionTestRuntime,
  describe,
  expect,
  expectCliError,
  join,
  link,
  lstat,
  mkdir,
  pageNumberRunner,
  readFile,
  readMarkdownPdfCodexReportArtifact,
  readMarkdownPdfProfileFile,
  symlink,
  test,
  withTempFixtureDir,
  writeFile,
} from "../markdown-pdf/actions/profile-codex-fixtures";

describe("cli action modules: md pdf-profile codex", () => {
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

  test("redacts parent traversal from report paths outside cwd", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-public-report-paths", async (fixtureDir) => {
      const workspace = join(fixtureDir, "workspace");
      const external = join(fixtureDir, "private-inputs");
      await mkdir(workspace, { recursive: true });
      await mkdir(external, { recursive: true });
      const inputPath = join(external, "client-report.md");
      const baseProfilePath = join(external, "client-base.yml");
      const outputPath = join(external, "client-profile.yml");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(baseProfilePath, "page:\n  size: Letter\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: workspace,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      await actionMdPdfProfileCodex(runtime, {
        baseProfile: baseProfilePath,
        codexReportOutput: "codex-report.json",
        codexRunner: pageNumberRunner("base-profile"),
        input: inputPath,
        intent: "durable body page numbers",
        output: outputPath,
      });

      const reportPath = join(workspace, "codex-report.json");
      const report = await readMarkdownPdfCodexReportArtifact(reportPath);
      expect(report.input.path).toBe("client-report.md");
      expect(report.selectedBase.path).toBe("client-base.yml");
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
      expect(rawReport).not.toContain(external);
      expect(rawReport).not.toContain("../");
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

  test("rejects symlink parents and hardlinked overwrite targets before calling Codex", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-parent-safety", async (fixtureDir) => {
      const realOutputDirectory = join(fixtureDir, "real-output");
      const outputAliasDirectory = join(fixtureDir, "output-link");
      const realReportDirectory = join(fixtureDir, "real-report");
      const reportAliasDirectory = join(fixtureDir, "report-link");
      await mkdir(realOutputDirectory, { recursive: true });
      await mkdir(realReportDirectory, { recursive: true });
      await symlink(realOutputDirectory, outputAliasDirectory);
      await symlink(realReportDirectory, reportAliasDirectory);

      let codexCalls = 0;
      const codexRunner = async () => {
        codexCalls += 1;
        return "{}";
      };
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexRunner,
            output: join(outputAliasDirectory, "profile.yml"),
            overwrite: true,
          }),
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
          messageIncludes: "--output parent directory is a symlink",
        },
      );

      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: join(reportAliasDirectory, "codex-report.json"),
            codexRunner,
            dryRun: true,
            output: "profile.yml",
            overwrite: true,
          }),
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
          messageIncludes: "--codex-report-output parent directory is a symlink",
        },
      );

      const hardlinkProfileTarget = join(fixtureDir, "hardlink-profile-target.yml");
      const hardlinkProfilePath = join(fixtureDir, "profile-hardlink.yml");
      await writeFile(hardlinkProfileTarget, "profile target\n", "utf8");
      await link(hardlinkProfileTarget, hardlinkProfilePath);
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexRunner,
            output: hardlinkProfilePath,
            overwrite: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--output is hard-linked",
        },
      );

      const hardlinkReportTarget = join(fixtureDir, "hardlink-report-target.json");
      const hardlinkReportPath = join(fixtureDir, "report-hardlink.json");
      await writeFile(hardlinkReportTarget, "{}\n", "utf8");
      await link(hardlinkReportTarget, hardlinkReportPath);
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexReportOutput: hardlinkReportPath,
            codexRunner,
            dryRun: true,
            output: "profile.yml",
            overwrite: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--codex-report-output is hard-linked",
        },
      );

      expect(codexCalls).toBe(0);
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
          messageIncludes: "--codex-report-output is hard-linked",
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
      await writeFile(
        join(fixtureDir, "invalid-arithmetic.yml"),
        "pageNumbers:\n  start: -1\n  increment: 0\n",
        "utf8",
      );
      await writeFile(
        join(fixtureDir, "invalid-origin.yml"),
        "pageNumbers:\n  scope: document\n  countFrom: body\n",
        "utf8",
      );
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
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            baseProfile: "invalid-arithmetic.yml",
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "report.md",
            intent: "report",
            output: "arithmetic-output.yml",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "pageNumbers.start must be a non-negative integer",
        },
      );
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            baseProfile: "invalid-origin.yml",
            codexRunner: async () => {
              codexCalls += 1;
              return "{}";
            },
            input: "report.md",
            intent: "report",
            output: "origin-output.yml",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "scope document cannot be used with countFrom body",
        },
      );
      expect(codexCalls).toBe(0);
      await expect(readFile(join(fixtureDir, "arithmetic-output.yml"), "utf8")).rejects.toThrow();
      await expect(readFile(join(fixtureDir, "origin-output.yml"), "utf8")).rejects.toThrow();
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
});
