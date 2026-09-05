import { describe, expect, test } from "bun:test";

import { actionRenameBatch } from "../../../src/cli/actions/rename/batch";
import { runRenameCodexAnalysis } from "../../../src/cli/actions/rename/codex/analyzer";
import { actionRenameFile } from "../../../src/cli/actions/rename/file";
import type {
  CodexExecutionOptions,
  ResolvedCodexExecution,
} from "../../../src/utils/codex-execution";
import { createCapturedRuntime } from "../../helpers/cli-test-utils";
import { createRenameFileFixture, withRenameWorkspace } from "./file-support";

describe("rename execution policy", () => {
  for (const extension of ["png", "md"]) {
    test(`file ${extension} analysis receives normalized immutable settings and scoped timeout`, async () => {
      await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
        const { runtime } = createCapturedRuntime();
        const { filePath } = await createRenameFileFixture(
          fixtureDir,
          "single",
          `source.${extension}`,
        );
        let calls = 0;
        const check = (options: { codexExecution?: CodexExecutionOptions; timeoutMs?: number }) => {
          calls++;
          expect(options.codexExecution).toEqual({
            model: "example-model",
            provider: "example-provider",
            reasoningEffort: "high",
          });
          expect(Object.isFrozen(options.codexExecution)).toBe(true);
          expect(options.timeoutMs).toBe(75_000);
          return { suggestions: [] };
        };
        const result = await actionRenameFile(runtime, {
          path: filePath,
          dryRun: true,
          codex: true,
          codexExecution: {
            model: " example-model ",
            provider: " example-provider ",
            reasoningEffort: "high",
          },
          codexTimeoutMs: 45_000,
          codexImagesTimeoutMs: 75_000,
          codexDocsTimeoutMs: 75_000,
          codexImagesTitleSuggester: async (options) => check(options),
          codexDocsTitleSuggester: async (options) => check(options),
        });
        trackPlanCsv(result.planCsvPath);
        expect(calls).toBe(1);
      });
    });
  }

  test("mixed batch preserves one policy across channel failure and input mutation", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      const { runtime, stdout } = createCapturedRuntime();
      const { dirPath, filePath: imagePath } = await createRenameFileFixture(
        fixtureDir,
        "mixed",
        "image.png",
      );
      const { filePath: docPath } = await createRenameFileFixture(fixtureDir, "mixed", "notes.md");
      const input: CodexExecutionOptions = {
        model: "model-a",
        provider: "provider-a",
        reasoningEffort: "medium",
      };
      let imagePolicy: ResolvedCodexExecution | undefined;
      let docCalls = 0;
      const result = await actionRenameBatch(runtime, {
        directory: dirPath,
        dryRun: true,
        codex: true,
        codexExecution: input,
        codexTimeoutMs: 45_000,
        codexImagesTimeoutMs: 75_000,
        codexImagesRetries: 2,
        codexDocsRetries: 1,
        codexImagesTitleSuggester: async (options) => {
          expect(options.imagePaths).toEqual([imagePath]);
          expect(options.timeoutMs).toBe(75_000);
          expect(options.retries).toBe(2);
          imagePolicy = options.codexExecution;
          input.model = "changed-after-start";
          input.reasoningEffort = "low";
          return { suggestions: [], errorMessage: "Requested effort is incompatible" };
        },
        codexDocsTitleSuggester: async (options) => {
          docCalls++;
          expect(options.documentPaths).toEqual([docPath]);
          expect(options.codexExecution).toBe(imagePolicy);
          expect(options.codexExecution).toEqual({
            model: "model-a",
            provider: "provider-a",
            reasoningEffort: "medium",
          });
          expect(Object.isFrozen(options.codexExecution)).toBe(true);
          expect(options.timeoutMs).toBe(45_000);
          expect(options.retries).toBe(1);
          return { suggestions: [{ path: docPath, title: "Document title" }] };
        },
      });
      trackPlanCsv(result.planCsvPath);
      expect(docCalls).toBe(1);
      expect(result.totalCount).toBe(2);
      expect(stdout.text).toContain("Requested effort is incompatible");
      expect(stdout.text).toContain("document-title");
    });
  });

  for (const action of ["file", "batch"] as const) {
    test(`${action} uses low and omits model/provider when no policy was supplied`, async () => {
      await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
        const { runtime } = createCapturedRuntime();
        const { filePath, dirPath } = await createRenameFileFixture(
          fixtureDir,
          "default",
          "image.png",
        );
        let calls = 0;
        const common = {
          dryRun: true,
          codex: true,
          codexImagesTitleSuggester: async (options: {
            codexExecution?: CodexExecutionOptions;
            timeoutMs?: number;
          }) => {
            calls++;
            expect(options.codexExecution).toEqual({ reasoningEffort: "low" });
            expect(Object.keys(options.codexExecution!)).toEqual(["reasoningEffort"]);
            expect(options.timeoutMs).toBe(30_000);
            return { suggestions: [] };
          },
        };
        const result =
          action === "file"
            ? await actionRenameFile(runtime, { path: filePath, ...common })
            : await actionRenameBatch(runtime, { directory: dirPath, ...common });
        trackPlanCsv(result.planCsvPath);
        expect(calls).toBe(1);
      });
    });

    test(`${action} execution options alone do not enable Codex`, async () => {
      await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
        const { runtime } = createCapturedRuntime();
        const { filePath, dirPath } = await createRenameFileFixture(
          fixtureDir,
          "disabled",
          "image.png",
        );
        let calls = 0;
        const common = {
          dryRun: true,
          codexExecution: { model: "example-model", reasoningEffort: "high" as const },
          codexImagesTitleSuggester: async () => {
            calls++;
            return { suggestions: [] };
          },
        };
        const result =
          action === "file"
            ? await actionRenameFile(runtime, { path: filePath, ...common })
            : await actionRenameBatch(runtime, { directory: dirPath, ...common });
        trackPlanCsv(result.planCsvPath);
        expect(calls).toBe(0);
      });
    });

    test(`${action} rejects invalid direct-call settings before planning with Codex disabled`, async () => {
      const { runtime, stdout } = createCapturedRuntime();
      let planningStarted = false;
      runtime.now = () => {
        planningStarted = true;
        throw new Error("Planning started");
      };
      const common = { codex: false, codexExecution: { provider: " " } };
      const request =
        action === "file"
          ? actionRenameFile(runtime, { path: "missing.png", ...common })
          : actionRenameBatch(runtime, { directory: "missing", ...common });
      await expect(request).rejects.toThrow("Codex provider must be a non-empty string");
      expect(planningStarted).toBe(false);
      expect(stdout.text).toBe("");
    });
  }

  test("direct analyzer calls validate before selecting candidates or invoking runners", async () => {
    const { runtime } = createCapturedRuntime();
    let calls = 0;
    await expect(
      runRenameCodexAnalysis(runtime, [], {
        effectiveFlags: { codexImages: true, codexDocs: true },
        cli: {
          codexExecution: { reasoningEffort: "invalid" } as unknown as CodexExecutionOptions,
          codexImagesTitleSuggester: async () => {
            calls++;
            return { suggestions: [] };
          },
        },
      }),
    ).rejects.toThrow("Codex reasoning effort must be one of");
    expect(calls).toBe(0);
  });
});
