import { describe, expect, test } from "bun:test";

import {
  DOCTOR_ACTION_IDS,
  DOCTOR_CONDITION_IDS,
  DOCTOR_WORKFLOWS,
  projectDoctorWorkflows,
  type DoctorAction,
  type DoctorActionClass,
  type DoctorActionId,
  type DoctorCondition,
  type DoctorConditionId,
  type DoctorWorkflow,
  type DoctorWorkflowId,
  type DoctorWorkflowProjection,
  type DoctorWorkflowState,
} from "../../src/cli/doctor/workflow";
import {
  DOCTOR_FIXTURE_CODEX,
  DOCTOR_FIXTURE_COMMANDS,
  DOCTOR_FIXTURE_QUERY,
  createDoctorFixture,
  createDoctorReportFromFixture,
} from "./fixtures";

function project(
  fixture: ReturnType<typeof createDoctorFixture>,
  platform: NodeJS.Platform = "darwin",
): DoctorWorkflowProjection {
  return projectDoctorWorkflows(createDoctorReportFromFixture(fixture, platform));
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

const CONDITION_CONTRACT = {
  "dependency.pandoc.missing": {
    affectedWorkflowIds: ["markdown.docx", "markdown.pdf"],
    message: "Pandoc is missing",
  },
  "dependency.pandoc.unsupported": {
    affectedWorkflowIds: ["markdown.pdf"],
    message: "Pandoc does not meet the required 2.0 minimum",
  },
  "dependency.pandoc.unverified": {
    affectedWorkflowIds: ["markdown.pdf"],
    message: "Pandoc 2.0 or newer could not be verified",
  },
  "dependency.weasyprint.missing": {
    affectedWorkflowIds: ["markdown.pdf"],
    message: "WeasyPrint is missing",
  },
  "dependency.ffmpeg.missing": {
    affectedWorkflowIds: ["video"],
    message: "FFmpeg is missing",
  },
  "dependency.fontconfig.discovery.missing": {
    affectedWorkflowIds: ["font.discovery"],
    message: "Fontconfig discovery is unavailable",
  },
  "dependency.fontconfig.coverage.missing": {
    affectedWorkflowIds: ["font.coverage"],
    message: "Fontconfig coverage is unavailable",
  },
  "markdown.pdf.renderer.capability.unsupported": {
    affectedWorkflowIds: ["markdown.pdf"],
    message: "Advanced Markdown PDF features require WeasyPrint 65.1 or newer",
  },
  "markdown.pdf.renderer.capability.unverified": {
    affectedWorkflowIds: ["markdown.pdf"],
    message: "Advanced Markdown PDF compatibility could not be verified",
  },
  "data.query.runtime.unavailable": {
    affectedWorkflowIds: ["data.query", "data.query.codex"],
    message: "DuckDB runtime is unavailable",
  },
  "data.query.extension.sqlite.unavailable": {
    affectedWorkflowIds: ["data.query"],
    message: "SQLite query support is unavailable but installable",
  },
  "data.query.extension.excel.unavailable": {
    affectedWorkflowIds: ["data.query"],
    message: "Excel query support is unavailable in this environment",
  },
  "data.query.codex.unconfigured": {
    affectedWorkflowIds: ["data.query.codex"],
    message: "Codex support is not configured",
  },
  "data.query.codex.unauthenticated": {
    affectedWorkflowIds: ["data.query.codex"],
    message: "No Codex authentication session is available",
  },
} satisfies Record<DoctorConditionId, Omit<DoctorCondition, "id">>;

const ACTION_CONTRACT = {
  "dependency.pandoc.install": {
    affectedWorkflowIds: ["markdown.docx", "markdown.pdf"],
    class: "required",
    command: "brew install pandoc",
    message: "Install Pandoc",
  },
  "dependency.pandoc.upgrade": {
    affectedWorkflowIds: ["markdown.pdf"],
    class: "required",
    message: "Upgrade Pandoc to 2.0 or newer",
  },
  "dependency.pandoc.verify": {
    affectedWorkflowIds: ["markdown.pdf"],
    class: "recommended",
    message: "Verify Pandoc 2.0 or newer",
  },
  "dependency.weasyprint.install": {
    affectedWorkflowIds: ["markdown.pdf"],
    class: "required",
    command: "brew install weasyprint",
    message: "Install WeasyPrint",
  },
  "dependency.weasyprint.upgrade": {
    affectedWorkflowIds: ["markdown.pdf"],
    class: "recommended",
    message: "Upgrade WeasyPrint to 65.1 or newer",
  },
  "dependency.weasyprint.verify": {
    affectedWorkflowIds: ["markdown.pdf"],
    class: "recommended",
    message: "Verify WeasyPrint 65.1 or newer",
  },
  "dependency.ffmpeg.install": {
    affectedWorkflowIds: ["video"],
    class: "required",
    command: "brew install ffmpeg",
    message: "Install FFmpeg",
  },
  "dependency.fontconfig.install": {
    affectedWorkflowIds: ["font.discovery"],
    class: "required",
    command: "brew install fontconfig",
    message: "Install Fontconfig",
  },
  "data.query.extension.sqlite.install": {
    affectedWorkflowIds: ["data.query"],
    class: "required",
    command: "cdx-chores data duckdb extension install sqlite",
    message: "Install the DuckDB SQLite extension",
  },
  "data.query.extension.excel.install": {
    affectedWorkflowIds: ["data.query"],
    class: "required",
    command: "cdx-chores data duckdb extension install excel",
    message: "Install the DuckDB Excel extension",
  },
  "data.query.codex.configure": {
    affectedWorkflowIds: ["data.query.codex"],
    class: "required",
    message: "Configure Codex support",
  },
  "data.query.codex.authenticate": {
    affectedWorkflowIds: ["data.query.codex"],
    class: "required",
    message: "Sign in to Codex or provide CODEX_API_KEY",
  },
} satisfies Record<DoctorActionId, Omit<DoctorAction, "id">>;

describe("doctor workflow projection", () => {
  test("keeps the complete public workflow facade available", () => {
    const fixture = createDoctorFixture({
      commands: {
        pandoc: { ...DOCTOR_FIXTURE_COMMANDS.pandoc, available: false, version: null },
      },
    });
    const projection: DoctorWorkflowProjection = projectDoctorWorkflows(
      createDoctorReportFromFixture(fixture),
    );
    const workflow: DoctorWorkflow = projection.workflows[0]!;
    const condition: DoctorCondition = projection.conditions[0]!;
    const action: DoctorAction = projection.actions[0]!;
    const workflowId: DoctorWorkflowId = workflow.id;
    const conditionId: DoctorConditionId = condition.id;
    const actionId: DoctorActionId = action.id;
    const state: DoctorWorkflowState = workflow.state;
    const actionClass: DoctorActionClass = action.class;

    expect({ workflowId, conditionId, actionId, state, actionClass }).toEqual({
      workflowId: "markdown.docx",
      conditionId: "dependency.pandoc.missing",
      actionId: "dependency.pandoc.install",
      state: "unavailable",
      actionClass: "required",
    });
    expect(Object.keys(CONDITION_CONTRACT)).toEqual([...DOCTOR_CONDITION_IDS]);
    expect(Object.keys(ACTION_CONTRACT)).toEqual([...DOCTOR_ACTION_IDS]);
  });

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

  test("orders a mixed report across every workflow boundary", () => {
    const projection = project(
      createDoctorFixture({
        codex: { configuredSupport: false, authSessionAvailable: false },
        commands: {
          ffmpeg: { ...DOCTOR_FIXTURE_COMMANDS.ffmpeg, available: false, version: null },
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
          weasyprint: { ...DOCTOR_FIXTURE_COMMANDS.weasyprint, version: "65.0" },
        },
        query: {
          ...DOCTOR_FIXTURE_QUERY,
          excel: {
            installed: false,
            loaded: false,
            loadable: false,
            installable: false,
          },
          sqlite: {
            installed: false,
            loaded: false,
            loadable: false,
            installable: true,
          },
        },
      }),
    );

    expect(conditionIds(projection)).toEqual([
      "markdown.pdf.renderer.capability.unsupported",
      "dependency.ffmpeg.missing",
      "data.query.extension.excel.unavailable",
      "data.query.extension.sqlite.unavailable",
      "data.query.codex.unconfigured",
      "dependency.fontconfig.discovery.missing",
      "dependency.fontconfig.coverage.missing",
    ]);
    expect(projection.actions.map(({ id, class: actionClass }) => [id, actionClass])).toEqual([
      ["dependency.ffmpeg.install", "required"],
      ["data.query.extension.sqlite.install", "required"],
      ["data.query.codex.configure", "required"],
      ["dependency.fontconfig.install", "required"],
      ["dependency.weasyprint.upgrade", "recommended"],
    ]);
    expect(states(projection)).toEqual({
      "markdown.docx": "ready",
      "markdown.pdf": "limited",
      video: "unavailable",
      "data.query": "limited",
      "data.query.codex": "unavailable",
      "font.discovery": "unavailable",
      "font.coverage": "unavailable",
    });
    expect(projection.issueCount).toBe(7);
    expect(projection.actionCount).toBe(5);
  });

  const cases: Array<{
    actions: DoctorActionId[];
    conditionMessages?: Partial<Record<DoctorConditionId, string>>;
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
      name: "weasyprint-missing",
      create: () =>
        createDoctorFixture({
          commands: {
            weasyprint: {
              ...DOCTOR_FIXTURE_COMMANDS.weasyprint,
              available: false,
              version: null,
            },
          },
        }),
      states: { "markdown.pdf": "unavailable" },
      conditions: ["dependency.weasyprint.missing"],
      actions: ["dependency.weasyprint.install"],
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
      conditionMessages: {
        "data.query.extension.sqlite.unavailable": "SQLite query support could not be verified",
      },
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
      expect(projection.conditions).toEqual(
        fixtureCase.conditions.map((id) => ({
          id,
          ...CONDITION_CONTRACT[id],
          message: fixtureCase.conditionMessages?.[id] ?? CONDITION_CONTRACT[id].message,
        })),
      );
      expect(projection.actions).toEqual(
        fixtureCase.actions.map((id) => ({ id, ...ACTION_CONTRACT[id] })),
      );
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

  test("uses one complete Windows hint when both Fontconfig probes are missing", () => {
    const projection = project(
      createDoctorFixture({
        commands: {
          "fc-list": {
            ...DOCTOR_FIXTURE_COMMANDS["fc-list"],
            available: false,
            version: null,
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
      "win32",
    );

    expect(projection.actions).toEqual([
      {
        id: "dependency.fontconfig.install",
        class: "required",
        message: "Install Fontconfig",
        command: "Install fontconfig and ensure fc-list and fc-query are on PATH",
        affectedWorkflowIds: ["font.discovery", "font.coverage"],
      },
    ]);
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
    expect(projection.actions).toEqual([
      { id: "data.query.codex.authenticate", ...ACTION_CONTRACT["data.query.codex.authenticate"] },
    ]);
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
