import { describe, expect, test } from "bun:test";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { __testOnlySuggestImageRenameTitlesWithBatch } from "../../../src/adapters/codex/image-rename-titles";
import {
  __testOnlySuggestDocumentRenameTitlesWithBatch,
  __testOnlySuggestDocumentRenameTitlesWithThread,
} from "../../../src/adapters/codex/document-rename-titles";
import type { CodexExecutionOptions } from "../../../src/utils/codex-execution";
import { createTempFixtureDir } from "../../helpers/cli-test-utils";

const execution = { model: "Model-A", provider: "Provider-A", reasoningEffort: "high" } as const;

describe("Codex rename execution configuration", () => {
  test.each([
    "Selected model rejects reasoning effort high",
    "Selected model does not support image input",
  ])("image batches retain policy and partial results on %s", async (message) => {
    const policies: CodexExecutionOptions[] = [];
    const result = await __testOnlySuggestImageRenameTitlesWithBatch(
      {
        imagePaths: ["/fixtures/a.png", "/fixtures/b.png"],
        workingDirectory: "/fixtures",
        batchSize: 1,
        retries: 1,
        codexExecution: execution,
      },
      async (options) => {
        policies.push(options.codexExecution);
        if (options.imagePaths[0]!.endsWith("a.png")) {
          return { suggestions: [{ path: options.imagePaths[0]!, title: "Landscape" }] };
        }
        throw new Error(message);
      },
    );
    expect(policies).toEqual([execution, execution, execution]);
    expect(policies[0]).toBe(policies[1]);
    expect(policies[1]).toBe(policies[2]);
    expect(result.suggestions).toEqual([{ path: "/fixtures/a.png", title: "Landscape" }]);
    expect(result.errorMessage).toContain("Partial Codex suggestions");
    expect(result.errorMessage).toContain(message);
  });

  test("document batches and incompatible retries retain settings and partial results", async () => {
    const dir = await createTempFixtureDir("rename-execution");
    try {
      const paths = [join(dir, "a.md"), join(dir, "b.md")];
      await Promise.all(
        paths.map((path) => writeFile(path, "# Project Notes\n\nCurrent decisions.\n")),
      );
      const policies: CodexExecutionOptions[] = [];
      const result = await __testOnlySuggestDocumentRenameTitlesWithBatch(
        {
          documentPaths: paths,
          workingDirectory: dir,
          batchSize: 1,
          retries: 1,
          codexExecution: execution,
        },
        async (options) => {
          policies.push(options.codexExecution);
          if (options.evidences[0]!.path === paths[0]) {
            return { suggestions: [{ path: paths[0]!, title: "Project Notes" }] };
          }
          throw new Error("Provider rejects selected model");
        },
      );
      expect(policies).toEqual([execution, execution, execution]);
      expect(policies[0]).toBe(policies[1]);
      expect(policies[1]).toBe(policies[2]);
      expect(result.suggestions).toEqual([{ path: paths[0]!, title: "Project Notes" }]);
      expect(result.errorMessage).toContain("Provider rejects selected model");

      for (const codexExecution of [undefined, execution]) {
        let calls = 0;
        await __testOnlySuggestDocumentRenameTitlesWithThread(
          { documentPaths: [paths[0]!], workingDirectory: dir, codexExecution },
          async (cwd, options) => {
            calls += 1;
            expect(cwd).toBe(dir);
            expect(options?.codexExecution).toEqual(codexExecution ?? { reasoningEffort: "low" });
            return {
              run: async (input) => {
                expect(JSON.stringify(input)).toContain("Project Notes");
                expect(JSON.stringify(input)).not.toContain("Provider-A");
                return { items: [], finalResponse: '{"suggestions":[]}', usage: null };
              },
            };
          },
        );
        expect(calls).toBe(1);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  test("invalid document settings reject before path access, evidence extraction, or runner startup", async () => {
    let accessed = false;
    let invoked = false;
    await expect(
      __testOnlySuggestDocumentRenameTitlesWithBatch(
        {
          get documentPaths(): string[] {
            accessed = true;
            throw new Error("Input accessed");
          },
          workingDirectory: "/fixtures",
          codexExecution: { provider: " " },
        },
        async () => {
          invoked = true;
          return { suggestions: [] };
        },
      ),
    ).rejects.toThrow("provider");
    expect(accessed).toBe(false);
    expect(invoked).toBe(false);
  });
});
