import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  actionDataDuckDbDoctor,
  actionDataDuckDbExtensionInstall,
  actionDoctor,
  actionMdToDocx,
  actionVideoConvert,
  actionVideoGif,
  actionVideoResize,
} from "../src/cli/actions";
import { inspectCommand, type DependencyCommandRunner } from "../src/cli/deps";
import {
  assessMarkdownPdfRendererCapabilities,
  MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS,
  MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX,
} from "../src/cli/markdown-pdf";
import type { ExecCommandResult } from "../src/cli/process";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { runCli, toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

function ok(stdout = "", stderr = ""): ExecCommandResult {
  return {
    ok: true,
    code: 0,
    signal: null,
    stdout,
    stderr,
  };
}

function doctorDependencyRunner(
  statuses: Record<string, ExecCommandResult>,
): DependencyCommandRunner {
  return async (command) => {
    const result = statuses[command];
    if (!result) {
      throw new Error(`spawn ${command} ENOENT`);
    }
    return result;
  };
}

function createDocxRunner() {
  const calls: Array<{ command: string; args: string[]; cwd?: string }> = [];
  const runner: DependencyCommandRunner = async (command, args, options) => {
    calls.push({ command, args, cwd: options?.cwd });

    if (command === "pandoc" && args.includes("--version")) {
      return ok("pandoc 3.1\n");
    }

    if (command === "pandoc") {
      const outputIndex = args.indexOf("-o");
      const outputPath = args[outputIndex + 1];
      if (!outputPath) {
        return {
          ok: false,
          code: 1,
          signal: null,
          stdout: "",
          stderr: "missing output",
        };
      }
      await writeFile(outputPath, "docx bytes", "utf8");
      return ok();
    }

    throw new Error(`unexpected command: ${command}`);
  };

  return { calls, runner };
}

describe("cli action modules: doctor", () => {
  test("actionDoctor emits machine-readable JSON payload", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

    await actionDoctor(runtime, { json: true });

    expectNoStderr();
    const payload = JSON.parse(stdout.text);
    expect(typeof payload.generatedAt).toBe("string");
    expect(payload.platform).toBe(process.platform);
    expect(typeof payload.nodeVersion).toBe("string");
    expect(payload.tools).toHaveProperty("pandoc");
    expect(payload.tools).toHaveProperty("ffmpeg");
    expect(payload.tools).toHaveProperty("weasyprint");
    expect(typeof payload.tools.pandoc.available).toBe("boolean");
    expect(typeof payload.tools.ffmpeg.available).toBe("boolean");
    expect(typeof payload.tools.weasyprint.available).toBe("boolean");
    expect(Object.hasOwn(payload.capabilities, "md.to-docx")).toBe(true);
    expect(Object.hasOwn(payload.capabilities, "md.to-pdf")).toBe(true);
    expect(typeof payload.markdownPdf.ready).toBe("boolean");
    expect(payload.markdownPdf.requirements.pandoc.minimumVersion).toBe("2.0");
    expect(typeof payload.markdownPdf.requirements.pandoc.status).toBe("string");
    expect(typeof payload.markdownPdf.requirements.weasyprint.status).toBe("string");
    expect(payload.markdownPdf.rendererCapabilities.renderer.name).toBe("weasyprint");
    expect(payload.markdownPdf.rendererCapabilities.capabilities).toHaveLength(
      MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX.length,
    );
    expect(Object.hasOwn(payload.capabilities, "video.gif")).toBe(true);
    expect(Object.hasOwn(payload.capabilities, "data.query.csv")).toBe(true);
    expect(Object.hasOwn(payload.capabilities, "data.query.duckdb")).toBe(true);
    expect(Object.hasOwn(payload.capabilities, "data.query.codex")).toBe(true);
    expect(Object.hasOwn(payload.capabilities, "font.discovery.fontconfig")).toBe(true);
    expect(Object.hasOwn(payload.capabilities, "font.coverage.fontconfig")).toBe(true);
    expect(payload.query).toBeDefined();
    expect(typeof payload.query.available).toBe("boolean");
    if (payload.query.available) {
      expect(typeof payload.query.runtimeVersion).toBe("string");
    }
    expect(payload.query.formats).toHaveProperty("csv");
    expect(payload.query.formats).toHaveProperty("duckdb");
    expect(payload.query.formats).toHaveProperty("sqlite");
    expect(payload.query.formats.csv.kind).toBe("core");
    expect(payload.query.formats.duckdb.kind).toBe("core");
    expect(typeof payload.query.formats.csv.detectedSupport).toBe("boolean");
    expect(typeof payload.query.formats.duckdb.detectedSupport).toBe("boolean");
    expect(Object.hasOwn(payload.query.formats.csv, "loadability")).toBe(false);
    expect(payload.query.formats.sqlite.kind).toBe("extension");
    expect(typeof payload.query.formats.sqlite.loadability).toBe("boolean");
    expect(payload.queryCodex).toBeDefined();
    expect(typeof payload.queryCodex.configuredSupport).toBe("boolean");
    expect(typeof payload.queryCodex.authSessionAvailable).toBe("boolean");
    expect(typeof payload.queryCodex.readyToDraft).toBe("boolean");
    expect(payload.font.discovery.fontconfig.command).toBe("fc-list");
    expect(typeof payload.font.discovery.fontconfig.available).toBe("boolean");
    expect(Object.hasOwn(payload.font.discovery.fontconfig, "version")).toBe(true);
    expect(payload.font.coverage.fontconfig.command).toBe("fc-query");
    expect(typeof payload.font.coverage.fontconfig.available).toBe("boolean");
    expect(Object.hasOwn(payload.font.coverage.fontconfig, "version")).toBe(true);
  });

  test("actionDoctor emits deterministic font support JSON for optional fontconfig gaps", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

    await actionDoctor(runtime, {
      json: true,
      dependencyRunner: doctorDependencyRunner({
        pandoc: ok("pandoc 3.9\n"),
        ffmpeg: ok("ffmpeg version 8.0.1\n"),
        weasyprint: ok("WeasyPrint version 67.0\n"),
        "fc-query": ok("fontconfig version 2.15.0\n"),
      }),
    });

    expectNoStderr();
    const payload = JSON.parse(stdout.text);
    expect(payload.font).toEqual({
      discovery: {
        fontconfig: {
          command: "fc-list",
          available: false,
          version: null,
        },
      },
      coverage: {
        fontconfig: {
          command: "fc-query",
          available: true,
          version: "2.15.0",
        },
      },
    });
    expect(payload.capabilities["font.discovery.fontconfig"]).toBe(false);
    expect(payload.capabilities["font.coverage.fontconfig"]).toBe(true);
  });

  test("actionDoctor emits human-readable text report", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

    await actionDoctor(runtime, { details: true });

    expectNoStderr();
    expect(stdout.text).toContain("cdx-chores doctor");
    expect(stdout.text).toContain("Platform:");
    expect(stdout.text).toContain("Node.js:");
    expect(stdout.text).toContain("Capabilities:");
    expect(stdout.text).toContain("md.to-docx");
    expect(stdout.text).toContain("md.to-pdf");
    expect(stdout.text).toContain("weasyprint");
    expect(stdout.text).toContain("Markdown PDF renderer capabilities:");
    expect(stdout.text).toContain("pageNumbers.start:");
    expect(stdout.text).toContain("video.gif");
    expect(stdout.text).toContain("Font support:");
    expect(stdout.text).toContain("fontconfig discovery:");
    expect(stdout.text).toContain("fontconfig coverage:");
    expect(stdout.text).toContain("Data query formats:");
    expect(stdout.text).toContain("Data query Codex:");
    expect(stdout.text).toContain("csv: built-in DuckDB support=");
    expect(stdout.text).toContain("duckdb: built-in DuckDB support=");
    expect(stdout.text).toContain("sqlite: detected support=");
    expect(stdout.text).toContain("ready-to-draft=");
    expect(stdout.text).not.toContain("csv: detected support=");
    expect(stdout.text).not.toContain(
      "csv: detected support=yes, loadability=yes, installability=unknown",
    );
  });

  test("actionDoctor renders optional font support status text", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

    await actionDoctor(runtime, {
      details: true,
      dependencyRunner: doctorDependencyRunner({
        pandoc: ok("pandoc 3.9\n"),
        ffmpeg: ok("ffmpeg version 8.0.1\n"),
        weasyprint: ok("WeasyPrint version 67.0\n"),
        "fc-query": ok("fontconfig version 2.15.0\n"),
      }),
    });

    expectNoStderr();
    expect(stdout.text).toContain("fontconfig discovery: unavailable");
    expect(stdout.text).toContain("fontconfig coverage: available (2.15.0)");
  });

  test("actionDoctor reports installed old Pandoc as unsupported for Markdown PDF only", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

    await actionDoctor(runtime, {
      json: true,
      dependencyRunner: doctorDependencyRunner({
        pandoc: ok("pandoc 1.19.2\n"),
        ffmpeg: ok("ffmpeg version 8.0.1\n"),
        weasyprint: ok("WeasyPrint version 68.0\n"),
        "fc-list": ok("fontconfig version 2.15.0\n"),
        "fc-query": ok("fontconfig version 2.15.0\n"),
      }),
    });

    expectNoStderr();
    const payload = JSON.parse(stdout.text);
    expect(payload.tools.pandoc).toMatchObject({
      available: true,
      version: "1.19.2",
    });
    expect(payload.markdownPdf).toMatchObject({
      ready: false,
      requirements: {
        pandoc: {
          status: "unsupported",
          available: true,
          version: "1.19.2",
          minimumVersion: "2.0",
        },
        weasyprint: {
          status: "satisfied",
          available: true,
          version: "68.0",
        },
      },
    });
    expect(payload.capabilities["md.to-docx"]).toBe(true);
    expect(payload.capabilities["md.to-pdf"]).toBe(false);
  });

  test("actionDoctor maps Markdown PDF requirement states to JSON readiness", async () => {
    const cases = [
      {
        statuses: {
          pandoc: ok("pandoc 3.9\n"),
          weasyprint: ok("WeasyPrint version 68.0\n"),
        },
        ready: true,
        pandocStatus: "satisfied",
        weasyprintStatus: "satisfied",
      },
      {
        statuses: {
          pandoc: ok("pandoc custom-build\n"),
          weasyprint: ok("WeasyPrint version 68.0\n"),
        },
        ready: false,
        pandocStatus: "unverified",
        weasyprintStatus: "satisfied",
      },
      {
        statuses: {
          weasyprint: ok("WeasyPrint version 68.0\n"),
        },
        ready: false,
        pandocStatus: "missing",
        weasyprintStatus: "satisfied",
      },
      {
        statuses: {
          pandoc: ok("pandoc 3.9\n"),
        },
        ready: false,
        pandocStatus: "satisfied",
        weasyprintStatus: "missing",
      },
    ] as const;

    for (const scenario of cases) {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDoctor(runtime, {
        json: true,
        dependencyRunner: doctorDependencyRunner({
          ffmpeg: ok("ffmpeg version 8.0.1\n"),
          "fc-list": ok("fontconfig version 2.15.0\n"),
          "fc-query": ok("fontconfig version 2.15.0\n"),
          ...scenario.statuses,
        }),
      });

      expectNoStderr();
      const payload = JSON.parse(stdout.text);
      expect(payload.markdownPdf.ready).toBe(scenario.ready);
      expect(payload.markdownPdf.requirements.pandoc.status).toBe(scenario.pandocStatus);
      expect(payload.markdownPdf.requirements.weasyprint.status).toBe(scenario.weasyprintStatus);
      expect(payload.capabilities["md.to-pdf"]).toBe(scenario.ready);
    }
  });

  test.each([
    ["below baseline", "65.0", "unsupported", "rendererCapabilityUnsupported"],
    ["exact baseline", "65.1", "satisfied", undefined],
    ["newer renderer", "68.0", "satisfied", undefined],
    ["unverified renderer", "custom-build", "unverified", "rendererCapabilityUnverified"],
    ["missing renderer", undefined, "missing", "rendererCapabilityMissing"],
  ] as const)(
    "projects request-neutral renderer capability parity for %s",
    async (_label, version, status, diagnosticKey) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDoctor(runtime, {
        json: true,
        dependencyRunner: doctorDependencyRunner({
          pandoc: ok("pandoc 3.9\n"),
          ffmpeg: ok("ffmpeg version 8.0.1\n"),
          ...(version ? { weasyprint: ok(`WeasyPrint version ${version}\n`) } : {}),
          "fc-list": ok("fontconfig version 2.15.0\n"),
          "fc-query": ok("fontconfig version 2.15.0\n"),
        }),
      });

      expectNoStderr();
      const payload = JSON.parse(stdout.text);
      const expected = assessMarkdownPdfRendererCapabilities({
        renderer: payload.tools.weasyprint,
      });
      expect(payload.markdownPdf.rendererCapabilities).toEqual(expected);
      expect(payload.markdownPdf.rendererCapabilities.renderer).toEqual({
        name: "weasyprint",
        available: version !== undefined,
        version: version ?? null,
      });
      expect(payload.markdownPdf.rendererCapabilities.capabilities).toHaveLength(
        MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX.length,
      );
      for (const [
        index,
        capability,
      ] of payload.markdownPdf.rendererCapabilities.capabilities.entries()) {
        const definition = MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX[index];
        expect(capability).toMatchObject({
          id: definition?.id,
          minimumVersion: definition?.minimumVersion,
          fields: definition?.fields,
          status,
        });
        if (diagnosticKey) {
          expect(capability.diagnosticConditionId).toBe(
            MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS[diagnosticKey],
          );
        } else {
          expect(capability).not.toHaveProperty("diagnosticConditionId");
        }
        expect(capability).not.toHaveProperty("requestedBy");
      }

      expect(payload.markdownPdf.ready).toBe(version !== undefined);
      expect(payload.capabilities["md.to-pdf"]).toBe(version !== undefined);
    },
  );

  test.each([
    [
      "below baseline",
      "65.0",
      "installed (65.0)",
      "md.to-pdf: available",
      "pageNumbers.start: unsupported, minimum=65.1, diagnostic=MARKDOWN_PDF_RENDERER_CAPABILITY_UNSUPPORTED",
      true,
    ],
    [
      "unverified renderer",
      "custom-build",
      "installed (custom-build)",
      "md.to-pdf: available",
      "pageNumbers.start: unverified, minimum=65.1, diagnostic=MARKDOWN_PDF_RENDERER_CAPABILITY_UNVERIFIED",
      true,
    ],
    [
      "missing renderer",
      undefined,
      "weasyprint: missing",
      "md.to-pdf: unavailable",
      "pageNumbers.start: missing, minimum=65.1, diagnostic=MARKDOWN_PDF_RENDERER_CAPABILITY_MISSING",
      true,
    ],
    [
      "exact baseline",
      "65.1",
      "installed (65.1)",
      "md.to-pdf: available",
      "pageNumbers.start: satisfied, minimum=65.1",
      false,
    ],
  ] as const)(
    "renders readable request-neutral capability detail for %s",
    async (_label, version, rendererText, readinessText, capabilityText, hasDiagnostic) => {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      await actionDoctor(runtime, {
        details: true,
        dependencyRunner: doctorDependencyRunner({
          pandoc: ok("pandoc 3.9\n"),
          ffmpeg: ok("ffmpeg version 8.0.1\n"),
          ...(version ? { weasyprint: ok(`WeasyPrint version ${version}\n`) } : {}),
          "fc-list": ok("fontconfig version 2.15.0\n"),
          "fc-query": ok("fontconfig version 2.15.0\n"),
        }),
      });

      expectNoStderr();
      expect(stdout.text).toContain("Markdown PDF renderer capabilities:");
      expect(stdout.text).toContain(rendererText);
      expect(stdout.text).toContain(readinessText);
      expect(stdout.text).toContain(capabilityText);
      if (!hasDiagnostic) {
        expect(stdout.text).not.toContain("MARKDOWN_PDF_RENDERER_CAPABILITY_");
      }
    },
  );

  test("keeps human capability status and IDs aligned with JSON for the same fixture", async () => {
    const statuses = {
      pandoc: ok("pandoc 3.9\n"),
      ffmpeg: ok("ffmpeg version 8.0.1\n"),
      weasyprint: ok("WeasyPrint version 65.0\n"),
      "fc-list": ok("fontconfig version 2.15.0\n"),
      "fc-query": ok("fontconfig version 2.15.0\n"),
    };
    const jsonRuntime = createActionTestRuntime();
    const humanRuntime = createActionTestRuntime();

    await actionDoctor(jsonRuntime.runtime, {
      json: true,
      dependencyRunner: doctorDependencyRunner(statuses),
    });
    await actionDoctor(humanRuntime.runtime, {
      details: true,
      dependencyRunner: doctorDependencyRunner(statuses),
    });

    jsonRuntime.expectNoStderr();
    humanRuntime.expectNoStderr();
    const payload = JSON.parse(jsonRuntime.stdout.text);
    expect(humanRuntime.stdout.text).toContain("Markdown PDF renderer capabilities:");
    for (const capability of payload.markdownPdf.rendererCapabilities.capabilities) {
      expect(humanRuntime.stdout.text).toContain(
        `${capability.id}: ${capability.status}, minimum=${capability.minimumVersion}`,
      );
      expect(humanRuntime.stdout.text).toContain(`diagnostic=${capability.diagnosticConditionId}`);
    }
    expect(payload.markdownPdf.ready).toBeTrue();
    expect(humanRuntime.stdout.text).toContain("md.to-pdf: available");
  });

  test("preserves doctor dependency-check failure semantics for a renderer probe exception", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    const runner: DependencyCommandRunner = async (command) => {
      if (command === "weasyprint") {
        throw new Error("renderer inspection crashed");
      }
      if (command === "pandoc") {
        return ok("pandoc 3.9\n");
      }
      if (command === "ffmpeg") {
        return ok("ffmpeg version 8.0.1\n");
      }
      if (command === "fc-list" || command === "fc-query") {
        return ok("fontconfig version 2.15.0\n");
      }
      throw new Error(`unexpected command: ${command}`);
    };

    await expectCliError(() => actionDoctor(runtime, { json: true, dependencyRunner: runner }), {
      code: "DEPENDENCY_CHECK_FAILED",
      exitCode: 2,
      messageIncludes: "renderer inspection crashed",
    });

    expect(stdout.text).toBe("");
    expectNoStderr();
  });

  test("actionDoctor explains unsupported and unverified Markdown PDF capability states", async () => {
    const cases = [
      {
        pandoc: "pandoc 1.19.2\n",
        expected: "md.to-pdf: unsupported",
        detail: "Pandoc 1.19.2 is below the required 2.0",
      },
      {
        pandoc: "pandoc custom-build\n",
        expected: "md.to-pdf: unverified",
        detail: "Pandoc 2.0 or newer could not be verified",
      },
    ] as const;

    for (const scenario of cases) {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionDoctor(runtime, {
        details: true,
        dependencyRunner: doctorDependencyRunner({
          pandoc: ok(scenario.pandoc),
          ffmpeg: ok("ffmpeg version 8.0.1\n"),
          weasyprint: ok("WeasyPrint version 68.0\n"),
          "fc-list": ok("fontconfig version 2.15.0\n"),
          "fc-query": ok("fontconfig version 2.15.0\n"),
        }),
      });

      expectNoStderr();
      expect(stdout.text).toContain(scenario.expected);
      expect(stdout.text).toContain(scenario.detail);
    }
  });

  test("actionDataDuckDbDoctor emits human-readable DuckDB extension report", async () => {
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

    await actionDataDuckDbDoctor(runtime);

    expectNoStderr();
    expect(stdout.text).toContain("cdx-chores data duckdb doctor");
    expect(stdout.text).toContain("DuckDB runtime:");
    expect(stdout.text).toContain("Managed extensions:");
    expect(stdout.text).toContain("sqlite:");
    expect(stdout.text).toContain("excel:");
  });

  test("actionDataDuckDbExtensionInstall requires an extension name unless --all-supported is used", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(() => actionDataDuckDbExtensionInstall(runtime, {}), {
      code: "INVALID_INPUT",
      exitCode: 2,
      messageIncludes: "Extension name is required unless --all-supported is used",
    });

    expectNoOutput();
  });

  test("actionDoctor reports an invalid codex override as unavailable", async () => {
    await withTempFixtureDir("doctor-codex-override", async (fixtureDir) => {
      const invalidOverride = join(fixtureDir, "missing-codex");

      const result = runCli(["doctor", "--json"], undefined, {
        CDX_CHORES_CODEX_PATH: invalidOverride,
        CODEX_API_KEY: "test-key",
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      const payload = JSON.parse(result.stdout);
      expect(payload.queryCodex.configuredSupport).toBe(false);
      expect(payload.queryCodex.readyToDraft).toBe(false);
      expect(payload.queryCodex.authSessionAvailable).toBe(true);
      expect(payload.queryCodex.detail).toContain("Codex override path is not executable");
      expect(payload.queryCodex.detail).toContain(invalidOverride);
      expect(payload.capabilities["data.query.codex"]).toBe(false);
    });
  });

  test("inspectCommand parses WeasyPrint version labels", async () => {
    const versions = [
      ["WeasyPrint version 67.0\n", "67.0"],
      ["WeasyPrint version: 67.0\n", "67.0"],
      ["System: test\nVersion: 67.0\n", "67.0"],
    ] as const;

    for (const [stdout, expectedVersion] of versions) {
      const status = await inspectCommand("weasyprint", "darwin", async () => ok(stdout));
      expect(status).toMatchObject({
        available: true,
        version: expectedVersion,
      });
    }
  });

  test("inspectCommand parses fontconfig version labels", async () => {
    const status = await inspectCommand("fc-query", "darwin", async () =>
      ok("fontconfig version 2.15.0\n"),
    );

    expect(status).toMatchObject({
      available: true,
      version: "2.15.0",
    });
  });

  test("inspectCommand treats missing fontconfig commands as optional unavailable tools", async () => {
    const status = await inspectCommand("fc-list", "darwin", async () => {
      throw new Error("spawn fc-list ENOENT");
    });

    expect(status).toMatchObject({
      name: "fc-list",
      available: false,
      version: null,
      installHint: "brew install fontconfig",
    });
  });
});

describe("cli action modules: markdown/video failure paths", () => {
  test("actionMdToDocx rejects missing input before dependency execution", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const missing = join(fixtureDir, "missing.md");

      await expectCliError(() => actionMdToDocx(runtime, { input: toRepoRelativePath(missing) }), {
        code: "FILE_NOT_FOUND",
        exitCode: 2,
        messageIncludes: "Input file not found:",
      });

      expectNoOutput();
    });
  });

  test("actionMdToDocx renders DOCX output with an injected runner", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.docx");
      await writeFile(inputPath, "# Report\n", "utf8");
      const { calls, runner } = createDocxRunner();
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToDocx(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        runner,
      });

      expect(calls.map((call) => call.args)).toEqual([
        ["--version"],
        [inputPath, "-o", outputPath],
      ]);
      expect(await readFile(outputPath, "utf8")).toBe("docx bytes");
      expect(stdout.text).toContain("Wrote DOCX:");
      expectNoStderr();
    });
  });

  test("actionMdToDocx refuses existing output without overwrite", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.docx");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(outputPath, "existing", "utf8");
      const { calls, runner } = createDocxRunner();
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToDocx(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
            runner,
          }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "Output file already exists",
        },
      );

      expect(calls.map((call) => call.args)).toEqual([["--version"]]);
      expect(await readFile(outputPath, "utf8")).toBe("existing");
      expectNoOutput();
    });
  });

  test("actionMdToDocx overwrites existing output when requested", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.docx");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(outputPath, "existing", "utf8");
      const { calls, runner } = createDocxRunner();
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToDocx(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        runner,
      });

      expect(calls.map((call) => call.args)).toEqual([
        ["--version"],
        [inputPath, "-o", outputPath],
      ]);
      expect(await readFile(outputPath, "utf8")).toBe("docx bytes");
      expect(stdout.text).toContain("Wrote DOCX:");
      expectNoStderr();
    });
  });

  test("actionVideoConvert rejects missing input before ffmpeg execution", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const missing = join(fixtureDir, "missing.mp4");

      await expectCliError(
        () =>
          actionVideoConvert(runtime, {
            input: toRepoRelativePath(missing),
            output: toRepoRelativePath(join(fixtureDir, "out.mov")),
          }),
        { code: "FILE_NOT_FOUND", exitCode: 2, messageIncludes: "Input file not found:" },
      );

      expectNoOutput();
    });
  });

  test("actionVideoGif rejects missing input before ffmpeg execution", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const missing = join(fixtureDir, "missing.mp4");

      await expectCliError(
        () => actionVideoGif(runtime, { input: toRepoRelativePath(missing), overwrite: true }),
        { code: "FILE_NOT_FOUND", exitCode: 2, messageIncludes: "Input file not found:" },
      );

      expectNoOutput();
    });
  });

  test("actionVideoResize validates width before file checks", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "input.mp4");
      await writeFile(inputPath, "fake", "utf8");

      await expectCliError(
        () =>
          actionVideoResize(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "out.mp4")),
            width: 0,
            height: 320,
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "Width must be a positive number." },
      );

      expectNoOutput();
    });
  });

  test("actionVideoResize validates scale before file checks", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "input.mp4");
      await writeFile(inputPath, "fake", "utf8");

      await expectCliError(
        () =>
          actionVideoResize(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "out.mp4")),
            scale: 0,
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "Scale must be a positive number." },
      );

      expectNoOutput();
    });
  });

  test("actionVideoResize validates height before file checks", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "input.mp4");
      await writeFile(inputPath, "fake", "utf8");

      await expectCliError(
        () =>
          actionVideoResize(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "out.mp4")),
            width: 320,
            height: 0,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Height must be a positive number.",
        },
      );

      expectNoOutput();
    });
  });

  test("actionVideoResize requires a complete resize mode before file checks", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "input.mp4");
      await writeFile(inputPath, "fake", "utf8");

      await expectCliError(
        () =>
          actionVideoResize(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "out.mp4")),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Provide --scale or both --width and --height.",
        },
      );

      expectNoOutput();
    });
  });

  test("actionVideoResize rejects mixing scale with explicit dimensions", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "input.mp4");
      await writeFile(inputPath, "fake", "utf8");

      await expectCliError(
        () =>
          actionVideoResize(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "out.mp4")),
            scale: 0.5,
            width: 640,
            height: 360,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Use either --scale or both --width and --height, not both.",
        },
      );

      expectNoOutput();
    });
  });

  test("actionVideoResize requires width and height together", async () => {
    await withTempFixtureDir("actions", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const inputPath = join(fixtureDir, "input.mp4");
      await writeFile(inputPath, "fake", "utf8");

      await expectCliError(
        () =>
          actionVideoResize(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(join(fixtureDir, "out.mp4")),
            width: 640,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Width and height must be provided together.",
        },
      );

      expectNoOutput();
    });
  });
});
