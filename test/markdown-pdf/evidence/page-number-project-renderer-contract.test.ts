import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";

import { actionMdPdfProjectCodex } from "../../../src/cli/markdown-pdf/project-codex";
import {
  materializePageNumberRendererContract,
  PAGE_NUMBER_LAB_MARKER_CONTENT,
  PAGE_NUMBER_LAB_MARKER_NAME,
  PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS,
} from "../../fixtures/markdown-pdf/page-number-renderer-contract";
import { createActionTestRuntime } from "../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";

describe("Markdown PDF deterministic Project renderer contract", () => {
  test("pins the no-base and base-profile live cases to the frozen candidates", () => {
    expect(
      PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS.map((scenario) => ({
        id: scenario.id,
        authoringMode: scenario.authoring.mode,
        candidates: scenario.candidateIds,
        launchModes: scenario.launchModes,
        liveCodexAllowed: scenario.authoring.liveCodexAllowed,
      })),
    ).toEqual([
      {
        id: "project-deterministic-no-base-bundle",
        authoringMode: "cover-image-only",
        candidates: ["wp-65-1"],
        launchModes: ["bundle"],
        liveCodexAllowed: false,
      },
      {
        id: "project-deterministic-base-profile-equivalence",
        authoringMode: "base-profile-only",
        candidates: ["wp-69-0"],
        launchModes: ["bundle", "explicit-roles"],
        liveCodexAllowed: false,
      },
    ]);

    expect(PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS[1]?.equivalenceBoundary).toEqual({
      compare: ["bundle", "explicit-roles"],
      automated: [
        "command outcome and warnings",
        "physical page count and dimensions",
        "extracted marker and page-number text by physical page",
        "page-number margin-box region",
        "diagnostics and renderer-capability outcomes",
      ],
      excluded: ["PDF byte equality", "PNG byte equality", "temporary paths"],
    });
  });

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

      for (const scenario of PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS) {
        const launch = contract.projectLaunches[scenario.id];
        expect(launch).toBeDefined();
        if (!launch) continue;
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
