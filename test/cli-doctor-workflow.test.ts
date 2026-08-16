import { describe, expect, test } from "bun:test";

import {
  DOCTOR_WORKFLOWS,
  projectDoctorWorkflows,
  type DoctorActionId,
  type DoctorConditionId,
  type DoctorWorkflowId,
  type DoctorWorkflowProjection,
  type DoctorWorkflowState,
} from "../src/cli/doctor/workflow";
import {
  DOCTOR_FIXTURE_CODEX,
  DOCTOR_FIXTURE_COMMANDS,
  DOCTOR_FIXTURE_QUERY,
  createDoctorFixture,
  createDoctorReportFromFixture,
} from "./helpers/doctor-test-fixtures";

function project(fixture: ReturnType<typeof createDoctorFixture>): DoctorWorkflowProjection {
  return projectDoctorWorkflows(createDoctorReportFromFixture(fixture));
}

function states(
  projection: DoctorWorkflowProjection,
): Record<DoctorWorkflowId, DoctorWorkflowState> {
  return Object.fromEntries(
    projection.workflows.map((workflow) => [workflow.id, workflow.state]),
  ) as Record<DoctorWorkflowId, DoctorWorkflowState>;
}

function conditionIds(projection: DoctorWorkflowProjection): DoctorConditionId[] {
  return projection.conditions.map((condition) => condition.id);
}

function actionIds(projection: DoctorWorkflowProjection): DoctorActionId[] {
  return projection.actions.map((action) => action.id);
}

const readyStates = Object.fromEntries(
  DOCTOR_WORKFLOWS.map((workflow) => [workflow.id, "ready"]),
) as Record<DoctorWorkflowId, DoctorWorkflowState>;

describe("doctor workflow projection", () => {
  test("projects the all-ready fixture into seven ordered ready workflows", () => {
    const projection = project(createDoctorFixture());

    expect(projection.workflows.map(({ id, label }) => ({ id, label }))).toEqual([
      ...DOCTOR_WORKFLOWS,
    ]);
    expect(states(projection)).toEqual(readyStates);
    expect(projection.conditions).toEqual([]);
    expect(projection.actions).toEqual([]);
    expect(projection.issueCount).toBe(0);
    expect(projection.actionCount).toBe(0);
  });

  const cases: Array<{
    actions: DoctorActionId[];
    conditions: DoctorConditionId[];
    create: () => ReturnType<typeof createDoctorFixture>;
    name: string;
    states: Partial<Record<DoctorWorkflowId, DoctorWorkflowState>>;
  }> = [
    {
      name: "pandoc-missing",
      create: () =>
        createDoctorFixture({
          commands: {
            pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, available: false, version: null },
          },
        }),
      states: { "markdown.docx": "unavailable", "markdown.pdf": "unavailable" },
      conditions: ["dependency.pandoc.missing"],
      actions: ["dependency.pandoc.install"],
    },
    {
      name: "weasyprint-old",
      create: () =>
        createDoctorFixture({
          commands: {
            weasyprint: { ...DOCTOR_FIXTURE_COMMANDS.weasyprint, version: "65.0" },
          },
        }),
      states: { "markdown.pdf": "limited" },
      conditions: ["markdown.pdf.renderer.capability.unsupported"],
      actions: ["dependency.weasyprint.upgrade"],
    },
    {
      name: "pandoc-unverified",
      create: () =>
        createDoctorFixture({
          commands: {
            pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, version: "custom-build" },
          },
        }),
      states: { "markdown.pdf": "unknown" },
      conditions: ["dependency.pandoc.unverified"],
      actions: ["dependency.pandoc.verify"],
    },
    {
      name: "duckdb-unavailable",
      create: () =>
        createDoctorFixture({
          query: {
            available: false,
            detail: "HOST_PATH /Users/alice/private.db TOKEN_ABC",
          },
        }),
      states: { "data.query": "unavailable", "data.query.codex": "unavailable" },
      conditions: ["data.query.runtime.unavailable"],
      actions: [],
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
      states: { "data.query": "limited" },
      conditions: ["data.query.extension.sqlite.unavailable"],
      actions: ["data.query.extension.sqlite.install"],
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
      states: { "data.query": "limited" },
      conditions: ["data.query.extension.excel.unavailable"],
      actions: [],
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
      states: { "data.query": "limited" },
      conditions: ["data.query.extension.sqlite.unavailable"],
      actions: [],
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
      states: { "data.query.codex": "unavailable" },
      conditions: ["data.query.codex.unconfigured"],
      actions: ["data.query.codex.configure"],
    },
    {
      name: "font-discovery-missing",
      create: () =>
        createDoctorFixture({
          commands: {
            "fc-list": {
              ...DOCTOR_FIXTURE_COMMANDS["fc-list"],
              available: false,
              version: null,
            },
          },
        }),
      states: { "font.discovery": "unavailable" },
      conditions: ["dependency.fontconfig.discovery.missing"],
      actions: ["dependency.fontconfig.install"],
    },
    {
      name: "multiple-actions",
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
            },
          },
        }),
      states: {
        "markdown.docx": "unavailable",
        "markdown.pdf": "unavailable",
        video: "unavailable",
        "data.query": "limited",
      },
      conditions: [
        "dependency.pandoc.missing",
        "dependency.ffmpeg.missing",
        "data.query.extension.sqlite.unavailable",
      ],
      actions: [
        "dependency.pandoc.install",
        "dependency.ffmpeg.install",
        "data.query.extension.sqlite.install",
      ],
    },
    {
      name: "duckdb-and-codex-unconfigured",
      create: () =>
        createDoctorFixture({
          query: { available: false },
          codex: { configuredSupport: false, authSessionAvailable: false },
        }),
      states: { "data.query": "unavailable", "data.query.codex": "unavailable" },
      conditions: ["data.query.runtime.unavailable", "data.query.codex.unconfigured"],
      actions: ["data.query.codex.configure"],
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
      states: { "markdown.docx": "unavailable", "markdown.pdf": "unavailable" },
      conditions: ["dependency.pandoc.missing"],
      actions: ["dependency.pandoc.install"],
    },
  ];

  for (const fixtureCase of cases) {
    test(`projects ${fixtureCase.name} with frozen states and identities`, () => {
      const projection = project(fixtureCase.create());

      expect(states(projection)).toEqual({ ...readyStates, ...fixtureCase.states });
      expect(conditionIds(projection)).toEqual(fixtureCase.conditions);
      expect(actionIds(projection)).toEqual(fixtureCase.actions);
      expect(projection.issueCount).toBe(fixtureCase.conditions.length);
      expect(projection.actionCount).toBe(fixtureCase.actions.length);
    });
  }

  test("links shared Pandoc condition and action to both Markdown workflows", () => {
    const projection = project(
      createDoctorFixture({
        commands: {
          pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, available: false, version: null },
        },
      }),
    );

    expect(projection.conditions[0]?.affectedWorkflowIds).toEqual([
      "markdown.docx",
      "markdown.pdf",
    ]);
    expect(projection.actions[0]?.affectedWorkflowIds).toEqual(["markdown.docx", "markdown.pdf"]);
  });

  test("keeps font conditions separate while deduplicating the shared install action", () => {
    const projection = project(
      createDoctorFixture({
        commands: {
          "fc-list": {
            ...DOCTOR_FIXTURE_COMMANDS["fc-list"],
            available: false,
            version: null,
          },
          "fc-query": {
            ...DOCTOR_FIXTURE_COMMANDS["fc-query"],
            available: false,
            version: null,
          },
        },
      }),
    );

    expect(conditionIds(projection)).toEqual([
      "dependency.fontconfig.discovery.missing",
      "dependency.fontconfig.coverage.missing",
    ]);
    expect(actionIds(projection)).toEqual(["dependency.fontconfig.install"]);
    expect(projection.actions[0]).toMatchObject({
      class: "required",
      command: "brew install fontconfig",
      affectedWorkflowIds: ["font.discovery", "font.coverage"],
    });
  });

  test("orders required actions before earlier-workflow recommendations", () => {
    const projection = project(
      createDoctorFixture({
        commands: {
          pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, version: "custom-build" },
          ffmpeg: { ...DOCTOR_FIXTURE_COMMANDS.ffmpeg, available: false, version: null },
        },
      }),
    );

    expect(projection.actions.map(({ id, class: actionClass }) => [id, actionClass])).toEqual([
      ["dependency.ffmpeg.install", "required"],
      ["dependency.pandoc.verify", "recommended"],
    ]);
  });

  test("uses only the closed extension helper for installable extension commands", () => {
    const projection = project(
      createDoctorFixture({
        query: {
          ...DOCTOR_FIXTURE_QUERY,
          sqlite: {
            installed: false,
            loaded: false,
            loadable: false,
            installable: true,
          },
          excel: {
            installed: false,
            loaded: false,
            loadable: false,
            installable: true,
          },
        },
      }),
    );

    expect(projection.actions.map(({ id, command }) => ({ id, command }))).toEqual([
      {
        id: "data.query.extension.excel.install",
        command: "cdx-chores data duckdb extension install excel",
      },
      {
        id: "data.query.extension.sqlite.install",
        command: "cdx-chores data duckdb extension install sqlite",
      },
    ]);
  });

  test("projects unsupported Pandoc as a PDF-only required upgrade", () => {
    const projection = project(
      createDoctorFixture({
        commands: {
          pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, version: "1.19" },
        },
      }),
    );

    expect(states(projection)).toMatchObject({
      "markdown.docx": "ready",
      "markdown.pdf": "unavailable",
    });
    expect(conditionIds(projection)).toEqual(["dependency.pandoc.unsupported"]);
    expect(projection.actions).toEqual([
      {
        id: "dependency.pandoc.upgrade",
        class: "required",
        message: "Upgrade Pandoc to 2.0 or newer",
        affectedWorkflowIds: ["markdown.pdf"],
      },
    ]);
  });

  test("preserves both independent base dependency failures for Markdown PDF", () => {
    const projection = project(
      createDoctorFixture({
        commands: {
          pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, available: false, version: null },
          weasyprint: {
            ...DOCTOR_FIXTURE_COMMANDS.weasyprint,
            available: false,
            version: null,
          },
        },
      }),
    );

    expect(conditionIds(projection)).toEqual([
      "dependency.pandoc.missing",
      "dependency.weasyprint.missing",
    ]);
    expect(actionIds(projection)).toEqual([
      "dependency.pandoc.install",
      "dependency.weasyprint.install",
    ]);
  });

  test("suppresses renderer uncertainty under an unknown Pandoc base requirement", () => {
    const projection = project(
      createDoctorFixture({
        commands: {
          pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, version: "custom-pandoc" },
          weasyprint: { ...DOCTOR_FIXTURE_COMMANDS.weasyprint, version: "custom-weasyprint" },
        },
      }),
    );

    expect(conditionIds(projection)).toEqual(["dependency.pandoc.unverified"]);
    expect(actionIds(projection)).toEqual(["dependency.pandoc.verify"]);
    expect(states(projection)["markdown.pdf"]).toBe("unknown");
  });

  test("projects renderer uncertainty as a limited PDF with a recommended verification", () => {
    const projection = project(
      createDoctorFixture({
        commands: {
          weasyprint: { ...DOCTOR_FIXTURE_COMMANDS.weasyprint, version: "custom-build" },
        },
      }),
    );

    expect(conditionIds(projection)).toEqual(["markdown.pdf.renderer.capability.unverified"]);
    expect(actionIds(projection)).toEqual(["dependency.weasyprint.verify"]);
    expect(states(projection)["markdown.pdf"]).toBe("limited");
    expect(projection.actions[0]?.class).toBe("recommended");
  });

  test("suppresses subordinate extension and authentication conditions", () => {
    const projection = project(
      createDoctorFixture({
        query: { available: false },
        codex: { configuredSupport: false, authSessionAvailable: false },
      }),
    );

    expect(conditionIds(projection)).toEqual([
      "data.query.runtime.unavailable",
      "data.query.codex.unconfigured",
    ]);
    expect(conditionIds(projection)).not.toContain("data.query.extension.sqlite.unavailable");
    expect(conditionIds(projection)).not.toContain("data.query.codex.unauthenticated");
  });

  test("preserves independent runtime and authentication conditions", () => {
    const projection = project(
      createDoctorFixture({
        query: { available: false },
        codex: { ...DOCTOR_FIXTURE_CODEX, authSessionAvailable: false },
      }),
    );

    expect(conditionIds(projection)).toEqual([
      "data.query.runtime.unavailable",
      "data.query.codex.unauthenticated",
    ]);
    expect(actionIds(projection)).toEqual(["data.query.codex.authenticate"]);
  });
});

describe("doctor compact projection trust boundary", () => {
  test("does not forward raw query, extension, Codex, path, secret, or error detail", () => {
    const fixture = createDoctorFixture({
      query: {
        available: true,
        runtimeVersion: "HOST_RUNTIME_SECRET",
        detail: "QUERY_ERROR permission denied /Users/alice/query TOKEN_QUERY",
        sqlite: {
          installed: false,
          loaded: false,
          loadable: false,
          installable: true,
          detail: "SQLITE_URL https://private.invalid TOKEN_SQLITE",
        },
        excel: {
          installed: false,
          loaded: false,
          loadable: false,
          installable: false,
          detail: "EXCEL_PATH /Users/alice/cache TOKEN_EXCEL",
        },
      },
      codex: {
        configuredSupport: false,
        authSessionAvailable: false,
        detail: "CODEX_OVERRIDE /Users/alice/codex TOKEN_CODEX",
      },
    });
    const report = createDoctorReportFromFixture(fixture);
    const serializedProjection = JSON.stringify(projectDoctorWorkflows(report));

    for (const forbidden of [
      "HOST_RUNTIME_SECRET",
      "QUERY_ERROR",
      "/Users/alice/query",
      "TOKEN_QUERY",
      "https://private.invalid",
      "TOKEN_SQLITE",
      "/Users/alice/cache",
      "TOKEN_EXCEL",
      "/Users/alice/codex",
      "TOKEN_CODEX",
    ]) {
      expect(serializedProjection).not.toContain(forbidden);
    }
    expect(serializedProjection).toContain("cdx-chores data duckdb extension install sqlite");
    expect(report.query.formats.sqlite.detail).toBe(
      "SQLITE_URL https://private.invalid TOKEN_SQLITE",
    );
    expect(report.query.formats.excel.detail).toBe("EXCEL_PATH /Users/alice/cache TOKEN_EXCEL");
    expect(report.queryCodex.detail).toBe("CODEX_OVERRIDE /Users/alice/codex TOKEN_CODEX");
  });

  test("does not interpolate detected dependency versions into compact-safe copy", () => {
    const projection = project(
      createDoctorFixture({
        commands: {
          pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, version: "DETECTED_PANDOC_SECRET" },
          weasyprint: {
            ...DOCTOR_FIXTURE_COMMANDS.weasyprint,
            version: "DETECTED_WEASYPRINT_SECRET",
          },
        },
      }),
    );
    const serializedProjection = JSON.stringify(projection);

    expect(serializedProjection).not.toContain("DETECTED_PANDOC_SECRET");
    expect(serializedProjection).not.toContain("DETECTED_WEASYPRINT_SECRET");
    expect(serializedProjection).toContain("Pandoc 2.0 or newer could not be verified");
  });
});
