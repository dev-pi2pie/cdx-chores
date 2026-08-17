import { candidateIdForVersion } from "./candidates";
import { PORTRAIT_SIZE } from "./shared-content";
import type { ProjectRendererScenario } from "./types";

const deterministicNoBaseProjectMarkdown = `---
title: PROJECT-NO-BASE-COVER
---

# PROJECT-NO-BASE-BODY-1

The no-base deterministic Project uses its canonical bundle launch on the oldest candidate.
`;

const deterministicBaseProjectMarkdown = `# PROJECT-BASE-BODY-1

The base-profile deterministic Project uses body-origin numbering.

<div style="break-after: page"></div>

# PROJECT-BASE-BODY-2

The second page preserves the configured arithmetic.
`;

const deterministicBaseProjectProfile = `page:
  size: A5
  orientation: portrait
  margin: 18mm

titleBlock:
  metadataTitle: hide

pageNumbers:
  enabled: true
  position: bottom-center
  format: "PROJECT-BASE-L{page}/{pages}-P{pdfPage}/{pdfPages}"
  scope: body
  countFrom: body
  start: 0
  increment: 2
`;

export const PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS: readonly ProjectRendererScenario[] = [
  {
    id: "project-deterministic-no-base-bundle",
    purpose:
      "Materialize a no-base deterministic Project without Codex and render its canonical bundle on the 65.1 baseline.",
    required: true,
    candidateIds: [candidateIdForVersion("65.1")],
    authoring: {
      mode: "cover-image-only",
      coverImage: {
        fileName: "cover.png",
        base64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+RQS4WQAAAABJRU5ErkJggg==",
      },
      expectedProjectSignalMode: "deterministic",
      liveCodexAllowed: false,
    },
    markdown: deterministicNoBaseProjectMarkdown,
    launchModes: ["bundle"],
    expected: {
      pageCount: 2,
      sizeMillimeters: [210, 297],
      orientation: "portrait",
      pages: [
        { role: "cover", marker: "PROJECT-NO-BASE-COVER", pageNumberLabels: [] },
        { role: "document-body", marker: "PROJECT-NO-BASE-BODY-1", pageNumberLabels: [] },
      ],
      pngPages: [1, 2],
    },
    visualReviewRequired: ["cover-transition"],
  },
  {
    id: "project-deterministic-base-profile-equivalence",
    purpose:
      "Materialize a base-profile deterministic Project without Codex and compare bundle versus explicit-role rendering on 69.0.",
    required: true,
    candidateIds: [candidateIdForVersion("69.0")],
    authoring: {
      mode: "base-profile-only",
      baseProfile: deterministicBaseProjectProfile,
      expectedProjectSignalMode: "deterministic",
      liveCodexAllowed: false,
    },
    markdown: deterministicBaseProjectMarkdown,
    launchModes: ["bundle", "explicit-roles"],
    expected: {
      pageCount: 2,
      sizeMillimeters: PORTRAIT_SIZE,
      orientation: "portrait",
      pages: [
        {
          role: "document-body",
          marker: "PROJECT-BASE-BODY-1",
          pageNumberLabels: ["PROJECT-BASE-L0/2-P1/2"],
          pageNumberRegion: "bottom-center",
        },
        {
          role: "document-body",
          marker: "PROJECT-BASE-BODY-2",
          pageNumberLabels: ["PROJECT-BASE-L2/2-P2/2"],
          pageNumberRegion: "bottom-center",
        },
      ],
      pngPages: [1, 2],
    },
    visualReviewRequired: [],
    equivalenceBoundary: {
      compare: ["bundle", "explicit-roles"],
      automated: [
        "command outcome and warnings",
        "physical page count and dimensions",
        "extracted marker and page-number text by physical page",
        "page-number margin-box region",
        "diagnostics and renderer-capability outcomes",
      ],
      excluded: ["PDF byte equality", "PNG byte equality", "temporary paths"],
    },
  },
];
