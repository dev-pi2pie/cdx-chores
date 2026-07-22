import { describe, expect, test } from "bun:test";
import { access, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { CliRuntime } from "../../src/cli/types";
import type {
  PreparedMarkdownPdfCodexCandidate,
  PreparedMarkdownPdfGeneratedCandidate,
} from "../../src/cli/interactive/markdown/codex-types";
import type { PreparedMarkdownPdfDeterministicRecipe } from "../../src/cli/interactive/markdown/deterministic-authoring";
import {
  cleanupOwnedMarkdownPdfSession,
  createOwnedMarkdownPdfSession,
} from "../../src/cli/interactive/markdown/lifecycle";
import {
  bindPreparedMarkdownPdfGeneratedCandidate,
  writeBoundMarkdownPdfGeneratedCandidate,
  type MarkdownPdfMaterializationServices,
} from "../../src/cli/interactive/markdown/materialization";
import { createActionTestRuntime } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";

interface ServiceCall {
  candidate: PreparedMarkdownPdfCodexCandidate | PreparedMarkdownPdfDeterministicRecipe;
  output: string;
  overwrite: boolean;
  report?: unknown;
}

function fakeCandidate(
  kind: "deterministic" | "codex",
  artifact: "profile" | "template-bundle" | "project-bundle",
): PreparedMarkdownPdfGeneratedCandidate {
  return {
    kind,
    candidate: { artifact, prepared: {}, setup: {} } as never,
  } as PreparedMarkdownPdfGeneratedCandidate;
}

function createServices(input: {
  externalReport?: string;
  calls: { binds: ServiceCall[]; writes: unknown[] };
  writeFailures?: string[];
}): MarkdownPdfMaterializationServices {
  const bind = async (
    _runtime: CliRuntime,
    candidate: PreparedMarkdownPdfCodexCandidate | PreparedMarkdownPdfDeterministicRecipe,
    options: { output: string; overwrite?: boolean; report?: unknown },
  ) => {
    const bound = { candidate, output: options.output };
    input.calls.binds.push({
      candidate,
      output: options.output,
      overwrite: options.overwrite ?? false,
      ...(options.report ? { report: options.report } : {}),
    });
    return bound;
  };
  const outputFiles = (bound: unknown): string[] => {
    const value = bound as { candidate: { artifact: string }; output: string };
    const artifactFiles =
      value.candidate.artifact === "profile"
        ? [value.output]
        : [join(value.output, "template.html"), join(value.output, "style.css")];
    return [...artifactFiles, ...(input.externalReport ? [input.externalReport] : [])];
  };
  const outputPath = (bound: unknown): string => (bound as { output: string }).output;
  const write = async (bound: unknown) => {
    input.calls.writes.push(bound);
    const failure = input.writeFailures?.shift();
    if (failure) {
      throw new Error(failure);
    }
  };
  return {
    bindCodex: bind,
    bindDeterministic: bind,
    codexOutputFiles: outputFiles,
    codexOutputPath: outputPath,
    deterministicOutputFiles: outputFiles,
    deterministicOutputPath: outputPath,
    writeCodex: async (_runtime, bound) => await write(bound),
    writeDeterministic: write,
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("interactive Markdown PDF generated-candidate materialization", () => {
  test.each([
    ["deterministic", "profile"],
    ["codex", "project-bundle"],
  ] as const)("binds and writes the accepted %s candidate exactly once", async (kind, artifact) => {
    const { runtime } = createActionTestRuntime();
    const session = await createOwnedMarkdownPdfSession();
    const calls = { binds: [] as ServiceCall[], writes: [] as unknown[] };
    const services = createServices({ calls });
    const candidate = fakeCandidate(kind, artifact);

    const bound = await bindPreparedMarkdownPdfGeneratedCandidate(
      runtime,
      candidate,
      { kind: "temporary", report: { kind: "none" }, session },
      services,
    );
    await writeBoundMarkdownPdfGeneratedCandidate(bound);

    expect(bound.acceptedCandidate).toBe(candidate);
    expect(calls.binds).toHaveLength(1);
    expect(calls.binds[0]?.candidate).toBe(candidate.candidate);
    expect(calls.writes).toHaveLength(1);
    expect(bound.rendererSource).toEqual(
      artifact === "profile" ? { profile: bound.destination } : { bundle: bound.destination },
    );
    expect(bound.destination).toBe(
      join(session.path, artifact === "profile" ? "profile.yml" : "project-bundle"),
    );
    await cleanupOwnedMarkdownPdfSession(session);
  });

  test("derives materialization and cleanup paths from the canonical owned session", async () => {
    const { runtime } = createActionTestRuntime();
    const rawPath = resolve("temporary-root-alias", "owned-session");
    const canonicalPath = resolve("canonical-temporary-root", "owned-session");
    const removeCalls: Array<{ path: string; options: unknown }> = [];
    const session = await createOwnedMarkdownPdfSession({
      createDirectory: async () => rawPath,
      canonicalizeDirectory: async (path) => {
        expect(path).toBe(rawPath);
        return canonicalPath;
      },
      removeDirectory: async (path, options) => {
        removeCalls.push({ path, options });
      },
    });
    const calls = { binds: [] as ServiceCall[], writes: [] as unknown[] };

    const bound = await bindPreparedMarkdownPdfGeneratedCandidate(
      runtime,
      fakeCandidate("deterministic", "profile"),
      { kind: "temporary", report: { kind: "none" }, session },
      createServices({ calls }),
    );

    expect(session.path).toBe(canonicalPath);
    expect(bound.destination).toBe(join(canonicalPath, "profile.yml"));
    expect(calls.binds[0]?.output).toBe(join(canonicalPath, "profile.yml"));

    await cleanupOwnedMarkdownPdfSession(session);
    expect(removeCalls).toEqual([
      { path: canonicalPath, options: { force: false, recursive: true } },
    ]);
  });

  test("rejects a repeated write of the same bound candidate", async () => {
    const { runtime } = createActionTestRuntime();
    const session = await createOwnedMarkdownPdfSession();
    const calls = { binds: [] as ServiceCall[], writes: [] as unknown[] };
    const bound = await bindPreparedMarkdownPdfGeneratedCandidate(
      runtime,
      fakeCandidate("deterministic", "profile"),
      { kind: "temporary", report: { kind: "none" }, session },
      createServices({ calls }),
    );

    await writeBoundMarkdownPdfGeneratedCandidate(bound);
    await expect(writeBoundMarkdownPdfGeneratedCandidate(bound)).rejects.toThrow("already written");
    expect(calls.writes).toHaveLength(1);
    await cleanupOwnedMarkdownPdfSession(session);
  });

  test("allows a failed write to retry the same bound candidate", async () => {
    const { runtime } = createActionTestRuntime();
    const session = await createOwnedMarkdownPdfSession();
    const calls = { binds: [] as ServiceCall[], writes: [] as unknown[] };
    const bound = await bindPreparedMarkdownPdfGeneratedCandidate(
      runtime,
      fakeCandidate("deterministic", "profile"),
      { kind: "temporary", report: { kind: "none" }, session },
      createServices({ calls, writeFailures: ["transient write failure"] }),
    );

    await expect(writeBoundMarkdownPdfGeneratedCandidate(bound)).rejects.toThrow(
      "transient write failure",
    );
    await writeBoundMarkdownPdfGeneratedCandidate(bound);

    expect(calls.binds).toHaveLength(1);
    expect(calls.writes).toHaveLength(2);
    await cleanupOwnedMarkdownPdfSession(session);
  });

  test("keeps an external temporary report outside the cleanup target", async () => {
    await withTempFixtureDir("md-pdf-materialization-report", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const session = await createOwnedMarkdownPdfSession();
      const reportPath = join(fixtureDir, "report.json");
      const calls = { binds: [] as ServiceCall[], writes: [] as unknown[] };
      const services = createServices({ calls, externalReport: reportPath });
      const bound = await bindPreparedMarkdownPdfGeneratedCandidate(
        runtime,
        fakeCandidate("codex", "profile"),
        { kind: "temporary", report: { kind: "external", path: reportPath }, session },
        services,
      );
      await writeFile(reportPath, "{}\n");

      expect(bound.outputFiles).toContain(reportPath);
      await cleanupOwnedMarkdownPdfSession(session);
      expect(await pathExists(reportPath)).toBe(true);
    });
  });

  test("never marks durable output as cleanup-owned", async () => {
    await withTempFixtureDir("md-pdf-materialization-durable", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const output = join(fixtureDir, "saved-project");
      const calls = { binds: [] as ServiceCall[], writes: [] as unknown[] };
      const bound = await bindPreparedMarkdownPdfGeneratedCandidate(
        runtime,
        fakeCandidate("codex", "project-bundle"),
        {
          kind: "durable",
          output,
          overwrite: true,
          report: { kind: "with-artifact" },
        },
        createServices({ calls }),
      );

      expect(bound).toMatchObject({ kind: "durable", destination: output });
      expect(bound).not.toHaveProperty("session");
      expect(calls.binds[0]).toMatchObject({
        output,
        overwrite: true,
        report: { kind: "with-artifact" },
      });
    });
  });

  test("rejects temporary with-artifact report retention before binding", async () => {
    const { runtime } = createActionTestRuntime();
    const session = await createOwnedMarkdownPdfSession();
    const calls = { binds: [] as ServiceCall[], writes: [] as unknown[] };

    await expect(
      bindPreparedMarkdownPdfGeneratedCandidate(
        runtime,
        fakeCandidate("codex", "profile"),
        {
          kind: "temporary",
          report: { kind: "with-artifact" },
          session,
        } as never,
        createServices({ calls }),
      ),
    ).rejects.toThrow("cannot retain a report with the artifact");
    expect(calls.binds).toHaveLength(0);
    await cleanupOwnedMarkdownPdfSession(session);
  });

  test("rejects an external report placed inside the owned session", async () => {
    const { runtime } = createActionTestRuntime();
    const session = await createOwnedMarkdownPdfSession();
    const reportPath = join(session.path, "external-report.json");
    const calls = { binds: [] as ServiceCall[], writes: [] as unknown[] };

    await expect(
      bindPreparedMarkdownPdfGeneratedCandidate(
        runtime,
        fakeCandidate("codex", "profile"),
        { kind: "temporary", report: { kind: "external", path: reportPath }, session },
        createServices({ calls, externalReport: reportPath }),
      ),
    ).rejects.toThrow("external report must be outside its owned session");
    await cleanupOwnedMarkdownPdfSession(session);
  });
});
