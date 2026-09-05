import { describe, expect, test } from "bun:test";

import { PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS } from "../../../fixtures/markdown-pdf/page-number-renderer-contract";

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
});
