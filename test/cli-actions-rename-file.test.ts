import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import { actionRenameFile } from "../src/cli/actions";
import {
  createCapturedRuntime,
  createTempFixtureDir,
  REPO_ROOT,
  toRepoRelativePath,
} from "./helpers/cli-test-utils";
import {
  captureRenamePlanCsvSnapshot,
  cleanupRenamePlanCsvSinceSnapshot,
  expectCliError,
  removeIfPresent,
} from "./helpers/cli-action-test-utils";

let renamePlanCsvSnapshot = new Set<string>();

beforeEach(async () => {
  renamePlanCsvSnapshot = await captureRenamePlanCsvSnapshot();
});

afterEach(async () => {
  await cleanupRenamePlanCsvSinceSnapshot(renamePlanCsvSnapshot);
});

const DEFAULT_RENAME_TIME = new Date("2026-02-25T03:04:05.000Z");

type RenameFileFixtureOptions = {
  content?: string;
  sourceFixture?: string;
  time?: Date;
};

async function createRenameFileFixture(
  fixtureDir: string,
  dirName: string,
  fileName: string,
  options: RenameFileFixtureOptions = {},
) {
  const dirPath = join(fixtureDir, dirName);
  const filePath = join(dirPath, fileName);
  await mkdir(dirPath, { recursive: true });
  if (options.sourceFixture) {
    await copyFile(options.sourceFixture, filePath);
  } else {
    await writeFile(filePath, options.content ?? "fake", "utf8");
  }
  const fixedTime = options.time ?? DEFAULT_RENAME_TIME;
  await utimes(filePath, fixedTime, fixedTime);
  return { dirPath, filePath };
}

async function withDocxExperimentalEnabled(run: () => Promise<void>) {
  const previousDocxGate = process.env.CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL;
  process.env.CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL = "1";
  try {
    await run();
  } finally {
    if (previousDocxGate === undefined) {
      delete process.env.CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL;
    } else {
      process.env.CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL = previousDocxGate;
    }
  }
}

async function withRenameWorkspace(
  run: (fixtureDir: string, trackPlanCsv: (path: string | undefined) => void) => Promise<void>,
) {
  const fixtureDir = await createTempFixtureDir("actions");
  let planCsvPath: string | undefined;
  try {
    await run(fixtureDir, (path) => {
      planCsvPath = path;
    });
  } finally {
    await removeIfPresent(planCsvPath);
    await rm(fixtureDir, { recursive: true, force: true });
  }
}

describe("cli action modules: rename file", () => {
  test("actionRenameFile dry-run previews one file and writes a replayable CSV plan", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const { dirPath, filePath } = await createRenameFileFixture(
        fixtureDir,
        "rename-file-dry-run",
        "cover image.png",
        {
          time: new Date("2026-02-25T15:16:17.000Z"),
        },
      );

      const result = await actionRenameFile(runtime, {
        path: toRepoRelativePath(filePath),
        prefix: "img",
        dryRun: true,
      });
      trackPlanCsv(result.planCsvPath);

      expect(stderr.text).toBe("");
      expect(result.changed).toBe(true);
      expect(result.planCsvPath).toBeDefined();
      expect(stdout.text).toContain(`Directory: ${toRepoRelativePath(dirPath)}`);
      expect(stdout.text).toContain(`File: ${toRepoRelativePath(filePath)}`);
      expect(stdout.text).toContain("- cover image.png -> img-");
      expect(stdout.text).toContain("Plan CSV:");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");

      const csvText = await readFile(result.planCsvPath!, "utf8");
      expect(csvText).toContain("cover image.png");
      expect(csvText).toContain(",planned,");
      expect((await stat(filePath)).isFile()).toBe(true);
    });
  });

  test("actionRenameFile applies a single-file rename with collision suffix handling", async () => {
    await withRenameWorkspace(async (fixtureDir) => {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const { dirPath, filePath: targetPath } = await createRenameFileFixture(
        fixtureDir,
        "rename-file-apply",
        "photo one.txt",
        {
          content: "a",
          time: new Date("2026-02-25T08:09:10.000Z"),
        },
      );

      const conflictingName = "doc-20260225-080910-photo-one.txt";
      await writeFile(join(dirPath, conflictingName), "occupied", "utf8");

      const result = await actionRenameFile(runtime, {
        path: toRepoRelativePath(targetPath),
        prefix: "doc",
        dryRun: false,
      });

      expect(stderr.text).toBe("");
      expect(result.changed).toBe(true);
      expect(stdout.text).toContain(`File: ${toRepoRelativePath(targetPath)}`);
      expect(stdout.text).toContain("Renamed 1 file(s).");

      const entries = (await readdir(dirPath)).sort();
      expect(entries).toContain(conflictingName);
      expect(entries.some((name) => /^doc-20260225-080910-photo-one-01\.txt$/.test(name))).toBe(
        true,
      );
    });
  });

  test("actionRenameFile without prefix omits the old implicit file prefix", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const { filePath } = await createRenameFileFixture(
        fixtureDir,
        "rename-file-no-prefix",
        "photo one.txt",
        {
          time: new Date("2026-02-25T15:16:17.000Z"),
        },
      );

      const result = await actionRenameFile(runtime, {
        path: toRepoRelativePath(filePath),
        dryRun: true,
      });
      trackPlanCsv(result.planCsvPath);

      expect(stderr.text).toBe("");
      expect(result.changed).toBe(true);
      expect(stdout.text).toContain("- photo one.txt -> 20260225-151617-photo-one.txt");
      expect(stdout.text).not.toContain("file-20260225-151617-photo-one.txt");
    });
  });

  test("actionRenameFile rejects symlink input paths", async () => {
    if (process.platform === "win32") {
      return;
    }

    await withRenameWorkspace(async (fixtureDir) => {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-file-symlink");
      await mkdir(dirPath, { recursive: true });

      const realPath = join(dirPath, "real.txt");
      const linkPath = join(dirPath, "link.txt");
      await writeFile(realPath, "real", "utf8");
      await symlink(realPath, linkPath);

      await expectCliError(
        () =>
          actionRenameFile(runtime, {
            path: toRepoRelativePath(linkPath),
            dryRun: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Symlink inputs are not supported for rename file:",
        },
      );

      expect(stdout.text).toBe("");
      expect(stderr.text).toBe("");
    });
  });

  test("actionRenameFile codex mode shows progress and fallback messaging when Codex returns an error", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const { filePath: imagePath } = await createRenameFileFixture(
        fixtureDir,
        "rename-file-codex-fallback",
        "single.png",
        {
          content: "fakepng",
        },
      );

      const result = await actionRenameFile(runtime, {
        path: toRepoRelativePath(imagePath),
        prefix: "img",
        dryRun: true,
        codexImages: true,
        codexImagesTitleSuggester: async () => ({
          suggestions: [],
          errorMessage: "Codex unavailable in test",
        }),
      });
      trackPlanCsv(result.planCsvPath);

      expect(stderr.text).toBe("");
      expect(result.changed).toBe(true);
      expect(stdout.text).toContain("Codex: analyzing 1 image file(s)...");
      expect(stdout.text).toContain(
        "Codex image titles: 0/1 image file(s) suggested (fallback used for others)",
      );
      expect(stdout.text).toContain("Codex note: Codex unavailable in test");
      expect(stdout.text).toContain("- single.png -> img-");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");
      const csvText = await readFile(result.planCsvPath!, "utf8");
      expect(csvText).toContain("codex_fallback_error");
    });
  });

  test("actionRenameFile codex auto routes markdown through the document analyzer", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const { filePath: docPath } = await createRenameFileFixture(
        fixtureDir,
        "rename-file-codex-auto-doc",
        "weekly notes.md",
        {
          content: "# Weekly Sync\n\nAgenda and action items.\n",
        },
      );

      let imageCalls = 0;
      let docCalls = 0;
      const result = await actionRenameFile(runtime, {
        path: toRepoRelativePath(docPath),
        prefix: "doc",
        dryRun: true,
        codex: true,
        codexImagesTitleSuggester: async () => {
          imageCalls += 1;
          return { suggestions: [] };
        },
        codexDocsTitleSuggester: async (options) => {
          docCalls += 1;
          return {
            suggestions: options.documentPaths.map((path) => ({
              path,
              title: "weekly sync notes",
            })),
          };
        },
      });
      trackPlanCsv(result.planCsvPath);

      expect(stderr.text).toBe("");
      expect(result.changed).toBe(true);
      expect(imageCalls).toBe(0);
      expect(docCalls).toBe(1);
      expect(stdout.text).toContain("Codex: analyzing 1 document file(s)...");
      expect(stdout.text).toContain("Codex doc titles: 1/1 document file(s) suggested");
      expect(stdout.text).toContain("- weekly notes.md -> doc-");
      expect(stdout.text).toContain("weekly-sync-notes");

      const csvText = await readFile(result.planCsvPath!, "utf8");
      expect(csvText).toContain("weekly sync notes");
    });
  });

  test("actionRenameFile codex-docs mode marks docx as experimental-disabled by default", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const { filePath: docPath } = await createRenameFileFixture(
        fixtureDir,
        "rename-file-codex-docx-disabled",
        "draft.docx",
        {
          content: "not-a-real-docx",
        },
      );

      const result = await actionRenameFile(runtime, {
        path: toRepoRelativePath(docPath),
        prefix: "doc",
        dryRun: true,
        codexDocs: true,
      });
      trackPlanCsv(result.planCsvPath);

      expect(stderr.text).toBe("");
      expect(result.changed).toBe(true);
      expect(stdout.text).toContain("Codex doc titles: 0/1 document file(s) suggested");
      expect(stdout.text).toContain("DOCX semantic titles are experimental and currently disabled");

      const csvText = await readFile(result.planCsvPath!, "utf8");
      expect(csvText).toContain("docx_experimental_disabled");
    });
  });

  test("actionRenameFile codex-docs mode records docx extraction error when experimental gate is enabled", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      await withDocxExperimentalEnabled(async () => {
        const { runtime, stdout, stderr } = createCapturedRuntime();
        const { filePath: docPath } = await createRenameFileFixture(
          fixtureDir,
          "rename-file-codex-docx-error",
          "broken.docx",
          {
            content: "not-a-real-docx",
          },
        );

        const result = await actionRenameFile(runtime, {
          path: toRepoRelativePath(docPath),
          prefix: "doc",
          dryRun: true,
          codexDocs: true,
        });
        trackPlanCsv(result.planCsvPath);

        expect(stderr.text).toBe("");
        expect(result.changed).toBe(true);
        expect(stdout.text).toContain("Codex: analyzing 1 document file(s)...");
        expect(stdout.text).toContain("Codex doc titles: 0/1 document file(s) suggested");
        expect(stdout.text).not.toContain("experimental and currently disabled");

        const csvText = await readFile(result.planCsvPath!, "utf8");
        expect(csvText).toContain("docx_extract_error");
      });
    });
  });

  test("actionRenameFile codex-docs mode can route a heading-rich docx fixture when experimental gate is enabled", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      await withDocxExperimentalEnabled(async () => {
        const { runtime, stdout, stderr } = createCapturedRuntime();
        const sourceFixture = join(REPO_ROOT, "test", "fixtures", "docs", "heading-rich.docx");
        const { filePath: docPath } = await createRenameFileFixture(
          fixtureDir,
          "rename-file-codex-docx-heading",
          "project-outline.docx",
          { sourceFixture },
        );

        const result = await actionRenameFile(runtime, {
          path: toRepoRelativePath(docPath),
          prefix: "doc",
          dryRun: true,
          codexDocs: true,
          codexDocsTitleSuggester: async (options) => ({
            suggestions: options.documentPaths.map((path) => ({
              path,
              title: "project goal outline",
            })),
          }),
        });
        trackPlanCsv(result.planCsvPath);

        expect(stderr.text).toBe("");
        expect(result.changed).toBe(true);
        expect(stdout.text).toContain("Codex: analyzing 1 document file(s)...");
        expect(stdout.text).toContain("Codex doc titles: 1/1 document file(s) suggested");
        expect(stdout.text).not.toContain("experimental and currently disabled");
        expect(stdout.text).toContain("project-goal-outline");

        const csvText = await readFile(result.planCsvPath!, "utf8");
        expect(csvText).toContain("project goal outline");
      });
    });
  });

});
