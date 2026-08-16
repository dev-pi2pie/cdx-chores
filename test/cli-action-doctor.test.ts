import { describe, expect, test } from "bun:test";

import { actionDoctor } from "../src/cli/actions";
import {
  assessMarkdownPdfRendererCapabilities,
  assessMarkdownPdfRequirements,
} from "../src/cli/markdown-pdf";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";
import { createDoctorFixture } from "./helpers/doctor-test-fixtures";

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

  test("does not read the JSON clock for the unchanged human default", async () => {
    const fixture = createDoctorFixture();
    let nowCalls = 0;
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime({
      now: () => {
        nowCalls += 1;
        return new Date("2026-08-16T00:00:00.000Z");
      },
    });
    runtime.platform = "darwin";

    await actionDoctor(runtime, { inspectors: fixture.inspectors });

    expectNoStderr();
    expect(nowCalls).toBe(0);
    expect(stdout.text).toContain("Capabilities:");
    expect(stdout.text).toContain("Data query Codex:");
  });
});
