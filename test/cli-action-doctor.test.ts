import { describe, expect, test } from "bun:test";

import { actionDoctor } from "../src/cli/actions";
import {
  assessMarkdownPdfRendererCapabilities,
  assessMarkdownPdfRequirements,
} from "../src/cli/markdown-pdf";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";
import {
  DOCTOR_FIXTURE_COMMANDS,
  DOCTOR_FIXTURE_QUERY,
  createDoctorFixture,
  createExpectedAllReadyDoctorHumanOutput,
  createExpectedDoctorJsonPayload,
} from "./helpers/doctor-test-fixtures";

function stripAnsi(value: string): string {
  const escape = String.fromCharCode(0x1b);
  return value.replace(new RegExp(`${escape}\\[[0-9;]*m`, "g"), "");
}

describe("doctor evidence report and legacy JSON projection", () => {
  test("preserves the complete all-ready legacy JSON contract under controlled inspectors", async () => {
    const fixture = createDoctorFixture();
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({
      now: () => new Date("2026-08-16T00:00:00.000Z"),
    });
    runtime.platform = "darwin";

    await actionDoctor(runtime, { json: true, inspectors: fixture.inspectors });

    expectNoStderr();
    const rendererCapabilities = assessMarkdownPdfRendererCapabilities({
      renderer: fixture.commands.weasyprint,
    });
    const markdownPdfRequirements = assessMarkdownPdfRequirements(
      fixture.commands.pandoc,
      fixture.commands.weasyprint,
    );
    const payload = JSON.parse(stdout.text);
    expect(payload).toEqual({
      generatedAt: "2026-08-16T00:00:00.000Z",
      platform: "darwin",
      nodeVersion: process.version,
      tools: {
        pandoc: fixture.commands.pandoc,
        ffmpeg: fixture.commands.ffmpeg,
        weasyprint: fixture.commands.weasyprint,
      },
      markdownPdf: {
        ...markdownPdfRequirements,
        rendererCapabilities,
      },
      query: {
        available: true,
        formats: {
          csv: { kind: "core", detectedSupport: true },
          tsv: { kind: "core", detectedSupport: true },
          parquet: { kind: "core", detectedSupport: true },
          duckdb: { kind: "core", detectedSupport: true },
          sqlite: {
            kind: "extension",
            detectedSupport: true,
            loadability: true,
            installability: true,
          },
          excel: {
            kind: "extension",
            detectedSupport: true,
            loadability: true,
            installability: true,
          },
        },
        runtimeVersion: "1.5.0",
      },
      queryCodex: {
        configuredSupport: true,
        authSessionAvailable: true,
        readyToDraft: true,
      },
      font: {
        discovery: {
          fontconfig: { command: "fc-list", available: true, version: "2.15.0" },
        },
        coverage: {
          fontconfig: { command: "fc-query", available: true, version: "2.15.0" },
        },
      },
      capabilities: {
        "md.to-docx": true,
        "md.to-pdf": true,
        "video.convert": true,
        "video.resize": true,
        "video.gif": true,
        "data.query.csv": true,
        "data.query.tsv": true,
        "data.query.parquet": true,
        "data.query.duckdb": true,
        "data.query.sqlite": true,
        "data.query.excel": true,
        "data.query.codex": true,
        "font.discovery.fontconfig": true,
        "font.coverage.fontconfig": true,
      },
    });
    expect(Object.keys(payload)).toEqual([
      "generatedAt",
      "platform",
      "nodeVersion",
      "tools",
      "markdownPdf",
      "query",
      "queryCodex",
      "font",
      "capabilities",
    ]);
    expect(Object.keys(payload.query.formats)).toEqual([
      "csv",
      "tsv",
      "parquet",
      "duckdb",
      "sqlite",
      "excel",
    ]);
    expect(fixture.calls).toEqual({
      commands: ["pandoc", "ffmpeg", "weasyprint", "fc-list", "fc-query"],
      query: 1,
      codex: 1,
    });
  });

  test("preserves unavailable-query omission, nullability, and raw detail semantics", async () => {
    const fixture = createDoctorFixture({
      query: {
        available: false,
        detail: "HOST_PATH /Users/alice/private.db TOKEN_ABC",
      },
    });
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({
      now: () => new Date("2026-08-16T00:00:00.000Z"),
    });
    runtime.platform = "darwin";

    await actionDoctor(runtime, { json: true, inspectors: fixture.inspectors });

    expectNoStderr();
    const payload = JSON.parse(stdout.text);
    expect(payload.query).toEqual({
      available: false,
      detail: "HOST_PATH /Users/alice/private.db TOKEN_ABC",
      formats: {
        csv: { kind: "core", detectedSupport: false },
        tsv: { kind: "core", detectedSupport: false },
        parquet: { kind: "core", detectedSupport: false },
        duckdb: { kind: "core", detectedSupport: false },
        sqlite: {
          kind: "extension",
          detectedSupport: false,
          loadability: false,
          installability: null,
        },
        excel: {
          kind: "extension",
          detectedSupport: false,
          loadability: false,
          installability: null,
        },
      },
    });
    expect(payload.query).not.toHaveProperty("runtimeVersion");
    expect(payload.query.formats.sqlite).not.toHaveProperty("detail");
    expect(payload.queryCodex).toEqual({
      configuredSupport: true,
      authSessionAvailable: true,
      readyToDraft: false,
      detail: "HOST_PATH /Users/alice/private.db TOKEN_ABC",
    });
    expect(payload.capabilities).toMatchObject({
      "data.query.csv": false,
      "data.query.sqlite": false,
      "data.query.codex": false,
    });
    expect(fixture.calls).toEqual({
      commands: ["pandoc", "ffmpeg", "weasyprint", "fc-list", "fc-query"],
      query: 1,
      codex: 1,
    });
  });

  test("does not read the JSON clock for the unchanged detailed view", async () => {
    const fixture = createDoctorFixture();
    let nowCalls = 0;
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({
      colorEnabled: false,
      now: () => {
        nowCalls += 1;
        return new Date("2026-08-16T00:00:00.000Z");
      },
    });
    runtime.platform = "darwin";

    await actionDoctor(runtime, { details: true, inspectors: fixture.inspectors });

    expectNoStderr();
    expect(nowCalls).toBe(0);
    expect(stdout.text).toBe(createExpectedAllReadyDoctorHumanOutput(fixture));
  });

  test("defaults to the exact compact all-ready view", async () => {
    const fixture = createDoctorFixture();
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "darwin";

    await actionDoctor(runtime, { inspectors: fixture.inspectors });

    expectNoStderr();
    expect(stdout.text).toBe(`cdx-chores doctor

0 issues · 0 actions

Workflows:
Markdown
  DOCX: ready
  PDF: ready
Video: ready
Data query: ready
Codex-assisted data query: ready
Fonts
  Discovery: ready
  Coverage: ready

Run \`cdx-chores doctor --details\` for versions and capability evidence.
`);
    expect(stdout.text).not.toContain("Platform:");
    expect(stdout.text).not.toContain("Capabilities:");
  });

  test("renders one compact issue and action without raw evidence", async () => {
    const fixture = createDoctorFixture({
      commands: {
        weasyprint: {
          ...DOCTOR_FIXTURE_COMMANDS.weasyprint,
          available: false,
          version: null,
        },
      },
      query: {
        ...DOCTOR_FIXTURE_QUERY,
        detail: "RAW_QUERY_TOKEN /Users/alice/query",
      },
    });
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "darwin";

    await actionDoctor(runtime, { inspectors: fixture.inspectors });

    expectNoStderr();
    expect(stdout.text).toContain("1 issue · 1 action");
    expect(stdout.text).toContain("  PDF: unavailable");
    expect(stdout.text).toContain("- WeasyPrint is missing (Markdown PDF)");
    expect(stdout.text).toContain("- Install WeasyPrint [required]");
    expect(stdout.text).toContain("  Affects: Markdown PDF");
    expect(stdout.text).toContain("  Command: brew install weasyprint");
    expect(stdout.text).not.toContain("RAW_QUERY_TOKEN");
    expect(stdout.text).not.toContain("/Users/alice/query");
  });

  test("continues the detailed view through Codex evidence when DuckDB is unavailable", async () => {
    const fixture = createDoctorFixture({
      query: {
        available: false,
        detail: "DUCKDB_RAW /Users/alice/duckdb",
      },
      codex: {
        configuredSupport: false,
        authSessionAvailable: false,
        detail: "CODEX_RAW /Users/alice/codex",
      },
    });
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
    runtime.platform = "darwin";

    await actionDoctor(runtime, { details: true, inspectors: fixture.inspectors });

    expectNoStderr();
    expect(stdout.text).toContain("- duckdb: unavailable (DUCKDB_RAW /Users/alice/duckdb)");
    expect(stdout.text).toContain("Data query Codex:");
    expect(stdout.text).toContain("CODEX_RAW /Users/alice/codex");
    expect(stdout.text.indexOf("Data query Codex:")).toBeGreaterThan(
      stdout.text.indexOf("Data query formats:"),
    );
  });

  test("keeps compact information content stable between TTY and redirected output", async () => {
    const redirectedFixture = createDoctorFixture({
      commands: {
        pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, available: false, version: null },
      },
    });
    const ttyFixture = createDoctorFixture({
      commands: {
        pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, available: false, version: null },
      },
    });
    const redirected = createActionTestRuntime({ colorEnabled: true });
    const tty = createActionTestRuntime({ colorEnabled: true });
    Object.assign(tty.runtime.stdout as object, { isTTY: true });

    await actionDoctor(redirected.runtime, { inspectors: redirectedFixture.inspectors });
    await actionDoctor(tty.runtime, { inspectors: ttyFixture.inspectors });

    redirected.expectNoStderr();
    tty.expectNoStderr();
    expect(stripAnsi(tty.stdout.text)).toBe(redirected.stdout.text);
    expect(tty.stdout.text).not.toBe(redirected.stdout.text);
  });

  test.each([
    {
      name: "limited renderer",
      create: () =>
        createDoctorFixture({
          commands: {
            weasyprint: { ...DOCTOR_FIXTURE_COMMANDS.weasyprint, version: "65.0" },
          },
        }),
      expected: [
        "  PDF: limited",
        "Advanced Markdown PDF features require WeasyPrint 65.1 or newer",
        "- Upgrade WeasyPrint to 65.1 or newer [recommended]",
      ],
      absent: [],
    },
    {
      name: "unknown Pandoc compatibility",
      create: () =>
        createDoctorFixture({
          commands: {
            pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, version: "custom-build" },
          },
        }),
      expected: [
        "  PDF: unknown",
        "Pandoc 2.0 or newer could not be verified",
        "- Verify Pandoc 2.0 or newer [recommended]",
      ],
      absent: [],
    },
    {
      name: "unavailable DuckDB without a safe action",
      create: () =>
        createDoctorFixture({
          query: { available: false, detail: "RAW_DUCKDB_FAILURE" },
        }),
      expected: [
        "Data query: unavailable",
        "Codex-assisted data query: unavailable",
        "1 issue · 0 actions",
        "DuckDB runtime is unavailable",
      ],
      absent: ["Actions:", "RAW_DUCKDB_FAILURE"],
    },
    {
      name: "constrained extension without an invented action",
      create: () =>
        createDoctorFixture({
          query: {
            ...DOCTOR_FIXTURE_QUERY,
            excel: {
              installed: false,
              loaded: false,
              loadable: false,
              installable: false,
              detail: "RAW_PERMISSION_FAILURE",
            },
          },
        }),
      expected: [
        "Data query: limited",
        "1 issue · 0 actions",
        "Excel query support is unavailable in this environment",
      ],
      absent: ["Actions:", "RAW_PERMISSION_FAILURE"],
    },
  ])("renders the compact $name state", async ({ create, expected, absent }) => {
    const fixture = create();
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });

    await actionDoctor(runtime, { inspectors: fixture.inspectors });

    expectNoStderr();
    for (const text of expected) expect(stdout.text).toContain(text);
    for (const text of absent) expect(stdout.text).not.toContain(text);
  });

  test("renders compact actions in the projection's stable order", async () => {
    const fixture = createDoctorFixture({
      commands: {
        pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, available: false, version: null },
        ffmpeg: { ...DOCTOR_FIXTURE_COMMANDS.ffmpeg, available: false, version: null },
      },
      query: {
        ...DOCTOR_FIXTURE_QUERY,
        sqlite: {
          installed: false,
          loaded: false,
          loadable: false,
          installable: true,
        },
      },
    });
    const { runtime, stdout } = createActionTestRuntime({ colorEnabled: false });

    await actionDoctor(runtime, { inspectors: fixture.inspectors });

    const pandoc = stdout.text.indexOf("- Install Pandoc [required]");
    const ffmpeg = stdout.text.indexOf("- Install FFmpeg [required]");
    const sqlite = stdout.text.indexOf("- Install the DuckDB SQLite extension [required]");
    expect(pandoc).toBeGreaterThan(-1);
    expect(ffmpeg).toBeGreaterThan(pandoc);
    expect(sqlite).toBeGreaterThan(ffmpeg);
  });

  const fixtureCases: Array<{
    create: () => ReturnType<typeof createDoctorFixture>;
    name: string;
  }> = [
    {
      name: "pandoc-missing",
      create: () =>
        createDoctorFixture({
          commands: {
            pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, available: false, version: null },
          },
        }),
    },
    {
      name: "weasyprint-old",
      create: () =>
        createDoctorFixture({
          commands: {
            weasyprint: { ...DOCTOR_FIXTURE_COMMANDS.weasyprint, version: "65.0" },
          },
        }),
    },
    {
      name: "pandoc-unverified",
      create: () =>
        createDoctorFixture({
          commands: {
            pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, version: "custom-build" },
          },
        }),
    },
    {
      name: "sqlite-installable",
      create: () =>
        createDoctorFixture({
          query: {
            ...DOCTOR_FIXTURE_QUERY,
            sqlite: {
              installed: false,
              loaded: false,
              loadable: false,
              installable: true,
              detail: "HOST_URL https://private.invalid",
            },
          },
        }),
    },
    {
      name: "excel-constrained",
      create: () =>
        createDoctorFixture({
          query: {
            ...DOCTOR_FIXTURE_QUERY,
            excel: {
              installed: false,
              loaded: false,
              loadable: false,
              installable: false,
              detail: "permission denied /Users/alice/cache",
            },
          },
        }),
    },
    {
      name: "sqlite-unknown",
      create: () =>
        createDoctorFixture({
          query: {
            ...DOCTOR_FIXTURE_QUERY,
            sqlite: {
              installed: false,
              loaded: false,
              loadable: false,
              installable: null,
              detail: "UNCLASSIFIED_SECRET",
            },
          },
        }),
    },
    {
      name: "codex-unconfigured",
      create: () =>
        createDoctorFixture({
          codex: {
            configuredSupport: false,
            authSessionAvailable: true,
            detail: "OVERRIDE /Users/alice/codex",
          },
        }),
    },
    {
      name: "font-discovery-missing",
      create: () =>
        createDoctorFixture({
          commands: {
            "fc-list": { ...DOCTOR_FIXTURE_COMMANDS["fc-list"], available: false, version: null },
          },
        }),
    },
    {
      name: "multiple-actions evidence",
      create: () =>
        createDoctorFixture({
          commands: {
            pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, available: false, version: null },
            ffmpeg: { ...DOCTOR_FIXTURE_COMMANDS.ffmpeg, available: false, version: null },
          },
          query: {
            ...DOCTOR_FIXTURE_QUERY,
            sqlite: {
              installed: false,
              loaded: false,
              loadable: false,
              installable: true,
              detail: "install it first",
            },
          },
        }),
    },
    {
      name: "duckdb-and-codex-unconfigured",
      create: () =>
        createDoctorFixture({
          query: { available: false, detail: "runtime unavailable" },
          codex: {
            configuredSupport: false,
            authSessionAvailable: false,
            detail: "Codex import unavailable",
          },
        }),
    },
    {
      name: "pandoc-missing-and-weasyprint-old",
      create: () =>
        createDoctorFixture({
          commands: {
            pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, available: false, version: null },
            weasyprint: { ...DOCTOR_FIXTURE_COMMANDS.weasyprint, version: "65.0" },
          },
        }),
    },
  ];

  for (const fixtureCase of fixtureCases) {
    test(`preserves complete serialized JSON for ${fixtureCase.name}`, async () => {
      const fixture = fixtureCase.create();
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({
        now: () => new Date("2026-08-16T00:00:00.000Z"),
      });
      runtime.platform = "darwin";

      await actionDoctor(runtime, { json: true, inspectors: fixture.inspectors });

      expectNoStderr();
      expect(stdout.text).toBe(
        `${JSON.stringify(createExpectedDoctorJsonPayload(fixture), null, 2)}\n`,
      );
    });
  }

  test.each(["query", "Codex"] as const)(
    "emits no partial output when the injected %s inspector rejects",
    async (boundary) => {
      const fixture = createDoctorFixture();
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
      const inspectors = {
        ...fixture.inspectors,
        ...(boundary === "query"
          ? {
              inspectDataQueryExtensions: async () => {
                throw new Error("query inspection failed");
              },
            }
          : {
              inspectCodexEnvironment: async () => {
                throw new Error("Codex inspection failed");
              },
            }),
      };

      await expect(actionDoctor(runtime, { json: true, inspectors })).rejects.toThrow(
        `${boundary} inspection failed`,
      );
      expect(stdout.text).toBe("");
      expectNoStderr();
    },
  );
});
