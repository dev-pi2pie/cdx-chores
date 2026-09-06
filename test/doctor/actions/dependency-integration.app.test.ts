import { describe, expect, test } from "bun:test";

import { actionDoctor } from "../../../src/cli/actions";
import type { DependencyCommandRunner } from "../../../src/cli/deps";
import {
  assessMarkdownPdfRendererCapabilities,
  MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS,
  MARKDOWN_PDF_RENDERER_CAPABILITY_MATRIX,
} from "../../../src/cli/markdown-pdf";
import type { ExecCommandResult } from "../../../src/cli/process";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";

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

describe("doctor action dependency integration", () => {
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
});
