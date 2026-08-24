import { describe, expect, test } from "bun:test";

import { actionDoctor } from "../../../src/cli/actions";
import { CliError } from "../../../src/cli/errors";
import {
  assessMarkdownPdfRendererCapabilities,
  assessMarkdownPdfRequirements,
} from "../../../src/cli/markdown-pdf";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";
import {
  DOCTOR_FIXTURE_COMMANDS,
  DOCTOR_FIXTURE_QUERY,
  createDoctorFixture,
  createExpectedAllReadyDoctorHumanOutput,
  createExpectedDoctorJsonPayload,
} from "../fixtures";

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

  test.each([
    ["compact", {}],
    ["detailed", { details: true }],
  ] as const)("preserves operational failure exit 2 before %s output", async (_view, options) => {
    const fixture = createDoctorFixture();
    const inspectors = {
      ...fixture.inspectors,
      inspectDataQueryExtensions: async () => {
        throw new CliError("Controlled query inspection failure", {
          code: "DATA_QUERY_INSPECTION_FAILED",
          exitCode: 2,
        });
      },
    };
    const { runtime, expectNoOutput } = createActionTestRuntime({ colorEnabled: false });

    await expectCliError(() => actionDoctor(runtime, { ...options, inspectors }), {
      code: "DATA_QUERY_INSPECTION_FAILED",
      exitCode: 2,
      messageIncludes: "Controlled query inspection failure",
    });

    expectNoOutput();
  });

  const fixtureCases: Array<{
    compact: { absent?: string[]; expected: string[] };
    create: () => ReturnType<typeof createDoctorFixture>;
    detailed: { absent?: string[]; expected: string[] };
    name: string;
    platform?: NodeJS.Platform;
  }> = [
    {
      name: "pandoc-missing",
      compact: {
        expected: [
          "  DOCX: unavailable",
          "  PDF: unavailable",
          "Pandoc is missing",
          "- Install Pandoc [required]",
        ],
      },
      detailed: {
        expected: [
          "- pandoc: missing",
          "Install suggestion: brew install pandoc",
          "- md.to-pdf: unavailable (Pandoc is missing)",
        ],
      },
      create: () =>
        createDoctorFixture({
          commands: {
            pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, available: false, version: null },
          },
        }),
    },
    {
      name: "weasyprint-old",
      compact: {
        expected: [
          "  PDF: limited",
          "Advanced Markdown PDF features require WeasyPrint 65.1 or newer",
          "- Upgrade WeasyPrint to 65.1 or newer [recommended]",
        ],
      },
      detailed: {
        expected: [
          "- weasyprint: available (65.0)",
          "Markdown PDF renderer capabilities:",
          "unsupported, minimum=65.1, diagnostic=",
        ],
      },
      create: () =>
        createDoctorFixture({
          commands: {
            weasyprint: { ...DOCTOR_FIXTURE_COMMANDS.weasyprint, version: "65.0" },
          },
        }),
    },
    {
      name: "pandoc-unverified",
      compact: {
        expected: [
          "  PDF: unknown",
          "Pandoc 2.0 or newer could not be verified",
          "- Verify Pandoc 2.0 or newer [recommended]",
        ],
      },
      detailed: {
        expected: [
          "- pandoc: available (custom-build)",
          "- md.to-pdf: unverified (Pandoc 2.0 or newer could not be verified)",
        ],
      },
      create: () =>
        createDoctorFixture({
          commands: {
            pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, version: "custom-build" },
          },
        }),
    },
    {
      name: "sqlite-installable",
      compact: {
        expected: [
          "Data query: limited",
          "SQLite query support is unavailable but installable",
          "- Install the DuckDB SQLite extension [required]",
          "Command: cdx-chores data duckdb extension install sqlite",
        ],
        absent: ["HOST_URL", "private.invalid"],
      },
      detailed: {
        expected: [
          "- sqlite: detected support=yes, loadability=no, installability=yes",
          "HOST_URL https://private.invalid",
          "Try: cdx-chores data duckdb extension install sqlite",
        ],
      },
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
      compact: {
        expected: [
          "Data query: limited",
          "Excel query support is unavailable in this environment",
          "1 issue · 0 actions",
        ],
        absent: ["Actions:", "permission denied", "/Users/alice/cache"],
      },
      detailed: {
        expected: [
          "- excel: detected support=yes, loadability=no, installability=no",
          "permission denied /Users/alice/cache",
        ],
        absent: ["Try: cdx-chores data duckdb extension install excel"],
      },
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
      compact: {
        expected: [
          "Data query: limited",
          "SQLite query support could not be verified",
          "1 issue · 0 actions",
        ],
        absent: ["Actions:", "UNCLASSIFIED_SECRET"],
      },
      detailed: {
        expected: [
          "- sqlite: detected support=yes, loadability=no, installability=unknown",
          "UNCLASSIFIED_SECRET",
        ],
      },
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
      compact: {
        expected: [
          "Codex-assisted data query: unavailable",
          "Codex support is not configured",
          "- Configure Codex support [required]",
        ],
        absent: ["OVERRIDE", "/Users/alice/codex"],
      },
      detailed: {
        expected: [
          "configured support=no, auth/session=yes, ready-to-draft=no",
          "OVERRIDE /Users/alice/codex",
        ],
      },
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
      compact: {
        expected: [
          "  Discovery: unavailable",
          "Fontconfig discovery is unavailable",
          "- Install Fontconfig [required]",
          "Command: brew install fontconfig",
        ],
      },
      detailed: {
        expected: ["- fontconfig discovery: unavailable", "- fontconfig coverage: available"],
      },
      create: () =>
        createDoctorFixture({
          commands: {
            "fc-list": { ...DOCTOR_FIXTURE_COMMANDS["fc-list"], available: false, version: null },
          },
        }),
    },
    {
      name: "font-coverage-missing-windows",
      platform: "win32",
      compact: {
        expected: [
          "  Coverage: unavailable",
          "Fontconfig coverage is unavailable",
          "- Install Fontconfig [required]",
          "Command: Install fontconfig and ensure fc-query is on PATH",
        ],
        absent: ["ensure fc-list is on PATH"],
      },
      detailed: {
        expected: ["- fontconfig discovery: available", "- fontconfig coverage: unavailable"],
      },
      create: () =>
        createDoctorFixture({
          commands: {
            "fc-list": {
              ...DOCTOR_FIXTURE_COMMANDS["fc-list"],
              installHint: "Install fontconfig and ensure fc-list is on PATH",
            },
            "fc-query": {
              ...DOCTOR_FIXTURE_COMMANDS["fc-query"],
              available: false,
              version: null,
              installHint: "Install fontconfig and ensure fc-query is on PATH",
            },
          },
        }),
    },
    {
      name: "multiple-actions evidence",
      compact: {
        expected: [
          "3 issues · 3 actions",
          "- Install Pandoc [required]",
          "- Install FFmpeg [required]",
          "- Install the DuckDB SQLite extension [required]",
        ],
        absent: ["install it first"],
      },
      detailed: {
        expected: [
          "- pandoc: missing",
          "- ffmpeg: missing",
          "- sqlite: detected support=yes, loadability=no, installability=yes",
          "install it first",
        ],
      },
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
      compact: {
        expected: [
          "2 issues · 1 action",
          "Data query: unavailable",
          "Codex-assisted data query: unavailable",
          "DuckDB runtime is unavailable",
          "Codex support is not configured",
          "- Configure Codex support [required]",
        ],
        absent: ["runtime unavailable", "Codex import unavailable"],
      },
      detailed: {
        expected: [
          "- duckdb: unavailable (runtime unavailable)",
          "configured support=no, auth/session=no, ready-to-draft=no",
          "Codex import unavailable",
        ],
      },
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
      compact: {
        expected: [
          "1 issue · 1 action",
          "  DOCX: unavailable",
          "  PDF: unavailable",
          "Pandoc is missing",
          "- Install Pandoc [required]",
        ],
        absent: ["Upgrade WeasyPrint"],
      },
      detailed: {
        expected: [
          "- pandoc: missing",
          "- weasyprint: available (65.0)",
          "- md.to-pdf: unavailable (Pandoc is missing)",
          "unsupported, minimum=65.1, diagnostic=",
        ],
      },
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
    test(`renders compact view for ${fixtureCase.name}`, async () => {
      const fixture = fixtureCase.create();
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({
        colorEnabled: false,
      });
      runtime.platform = fixtureCase.platform ?? "darwin";

      await actionDoctor(runtime, { inspectors: fixture.inspectors });

      expectNoStderr();
      for (const text of fixtureCase.compact.expected) expect(stdout.text).toContain(text);
      for (const text of fixtureCase.compact.absent ?? []) {
        expect(stdout.text).not.toContain(text);
      }
    });

    test(`renders detailed view for ${fixtureCase.name}`, async () => {
      const fixture = fixtureCase.create();
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({
        colorEnabled: false,
      });
      runtime.platform = fixtureCase.platform ?? "darwin";

      await actionDoctor(runtime, { details: true, inspectors: fixture.inspectors });

      expectNoStderr();
      for (const text of fixtureCase.detailed.expected) expect(stdout.text).toContain(text);
      for (const text of fixtureCase.detailed.absent ?? []) {
        expect(stdout.text).not.toContain(text);
      }
    });

    test(`preserves complete serialized JSON for ${fixtureCase.name}`, async () => {
      const fixture = fixtureCase.create();
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({
        now: () => new Date("2026-08-16T00:00:00.000Z"),
      });
      runtime.platform = fixtureCase.platform ?? "darwin";

      await actionDoctor(runtime, { json: true, inspectors: fixture.inspectors });

      expectNoStderr();
      expect(stdout.text).toBe(
        `${JSON.stringify(
          createExpectedDoctorJsonPayload(
            fixture,
            "2026-08-16T00:00:00.000Z",
            fixtureCase.platform,
          ),
          null,
          2,
        )}\n`,
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
