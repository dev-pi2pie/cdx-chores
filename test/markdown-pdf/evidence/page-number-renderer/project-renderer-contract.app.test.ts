import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";

import { actionMdPdfProjectCodex } from "../../../../src/cli/markdown-pdf/project-codex";
import {
  materializePageNumberRendererContract,
  PAGE_NUMBER_LAB_MARKER_CONTENT,
  PAGE_NUMBER_LAB_MARKER_NAME,
  PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS,
} from "../../../fixtures/markdown-pdf/page-number-renderer-contract";
import { createActionTestRuntime } from "../../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../../helpers/cli-test-utils";

describe("Markdown PDF deterministic Project renderer contract", () => {
  test("materializes both deterministic Projects without invoking Codex", async () => {
    await withTempFixtureDir("page-number-project-renderer-contract", async (labRoot) => {
      await writeFile(
        `${labRoot}/${PAGE_NUMBER_LAB_MARKER_NAME}`,
        PAGE_NUMBER_LAB_MARKER_CONTENT,
        "utf8",
      );
      const contract = await materializePageNumberRendererContract(labRoot);
      let codexCalls = 0;
      const forbiddenCodexRunner = async () => {
        codexCalls += 1;
        throw new Error("deterministic Project fixture must not invoke Codex");
      };

      const requiredProjects = [
        { id: "project-deterministic-no-base-bundle", mode: "cover-image-only" },
        { id: "project-deterministic-base-profile-equivalence", mode: "base-profile-only" },
      ] as const;
      for (const required of requiredProjects) {
        const scenario = PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS.find(
          (candidate) => candidate.id === required.id,
        );
        expect(scenario).toBeDefined();
        if (!scenario) throw new Error(`missing required product scenario: ${required.id}`);
        expect(scenario.authoring.mode).toBe(required.mode);
        const launch = contract.projectLaunches[required.id];
        expect(launch).toBeDefined();
        if (!launch) throw new Error(`missing required product launch: ${required.id}`);
        expect(Boolean(launch.coverImagePath)).toBe(required.mode === "cover-image-only");
        expect(Boolean(launch.baseProfilePath)).toBe(required.mode === "base-profile-only");
        const { runtime, stdout } = createActionTestRuntime({
          cwd: launch.authoringDirectory,
          now: () => new Date("2026-08-13T08:00:00.000Z"),
        });
        await actionMdPdfProjectCodex(runtime, {
          ...(launch.baseProfilePath ? { baseProfile: launch.baseProfilePath } : {}),
          ...(launch.coverImagePath ? { coverImage: launch.coverImagePath } : {}),
          output: launch.projectDirectory,
          identityUidFactory: () => "face1200",
          profileCodexRunner: forbiddenCodexRunner,
          templateCodexRunner: forbiddenCodexRunner,
        });

        expect(stdout.text).toContain("Project signal mode: deterministic");
        expect(await readFile(launch.markdownPath, "utf8")).toBe(scenario.markdown);
        expect(await readFile(launch.profilePath, "utf8")).toContain("profile:");
        expect(await readFile(launch.templatePath, "utf8")).toContain("$body$");
        expect(await readFile(launch.cssPath, "utf8")).toContain("@page");
      }

      expect(codexCalls).toBe(0);
    });
  });
});
