import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../../cli-interactive-routing.helpers";
import { TO_PDF_ENTRY, recipesCodexSelections } from "./codex-authoring-fixtures";

describe("interactive Markdown PDF Codex Project handoff", () => {
  test.each(
    (["profile", "template-bundle", "project-bundle"] as const).flatMap((artifact) =>
      (["inherit", "enable", "disable"] as const).map((choice) => [artifact, choice] as const),
    ),
  )(
    "passes generated Codex %s page numbers %s through the accepted candidate",
    (artifact, choice) => {
      const compiled = choice === "inherit" ? undefined : choice === "enable";
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [
          ...TO_PDF_ENTRY,
          "generated",
          artifact,
          ...(artifact === "project-bundle" ? [] : ["codex-assistant"]),
          "continue",
          "temporary-render",
          "inherit",
          choice,
          "none",
          "default",
        ],
        inputQueue: [""],
        requiredPathQueue: ["fixtures/report.md"],
        confirmQueue: [false, true, false, true],
      });

      expect(result.markdownPdfCodexPrepareCalls).toEqual([
        expect.objectContaining({ artifact, candidateId: `codex-${artifact}-1` }),
      ]);
      expect(result.markdownPdfCodexBindCalls).toEqual([
        expect.objectContaining({ artifact, candidateId: `codex-${artifact}-1` }),
      ]);
      expect(result.markdownPdfCodexWriteCalls).toEqual([
        expect.objectContaining({ artifact, candidateId: `codex-${artifact}-1` }),
      ]);
      expect(result.markdownPdfPrepareCalls).toHaveLength(1);
      if (compiled !== undefined) {
        expect(result.markdownPdfPrepareCalls[0]).toEqual(
          expect.objectContaining({ pageNumbers: compiled }),
        );
      }
      if (compiled === undefined) {
        expect(result.markdownPdfPrepareCalls[0]).not.toHaveProperty("pageNumbers");
      }
    },
  );

  test.each([
    ["profile", true],
    ["template-bundle", false],
    ["project-bundle", true],
  ] as const)(
    "shows reusable Profile code settings only for %s candidates",
    (artifact, ownsProfile) => {
      const result = runInteractiveHarness({
        mode: "run",
        markdownPdfMocks: true,
        selectQueue: [...recipesCodexSelections(artifact), "continue", "cancel"],
        inputQueue: [""],
        confirmQueue: [false, true],
      });

      if (ownsProfile) {
        expect(result.stderr).toContain("Reusable Profile settings:");
        expect(result.stderr).toContain("- Highlighting: enabled");
        expect(result.stderr).toContain("- Code highlighting theme: light-plus");
        expect(result.stderr).toContain("- Line numbers: enabled");
        expect(result.stderr).toContain("- Transformer notation: disabled");
      } else {
        expect(result.stderr).not.toContain("Reusable Profile settings:");
      }
      if (artifact === "project-bundle") {
        expect(
          result.promptCalls.filter((call) => call.message === "Choose preparation mode"),
        ).toHaveLength(0);
      }
    },
  );

  test("reviews Project page numbers and handoff state without an Interactive override", () => {
    const escape = "\u001B";
    const bell = "\u0007";
    const privateDiagnostic = `Rejected /Users/alice/private/style.css ${escape}]0;unsafe${bell}`;
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfCodexFinalProfile: {
        pageNumbers: {
          enabled: true,
          scope: "body",
          countFrom: "body",
          start: 0,
          increment: 2,
          position: "bottom-right",
          format: "Page /Users/alice/private/{page}",
        },
      },
      markdownPdfCodexProjectHandoff: {
        profile: {
          id: "md-pdf-profile-20260101T000000Z-abc12345",
          bundlePath: "profile.yml",
        },
        artifacts: { availability: "planned" },
        render: {
          usability: "planned",
          command: {
            executable: "cdx-chores",
            args: [
              "md",
              "to-pdf",
              "--input",
              "fixtures/report.md",
              "--bundle",
              "generated/codex-project-bundle-1",
              "--output",
              "<output.pdf>",
            ],
            display:
              "cdx-chores 'md' 'to-pdf' '--input' 'fixtures/report.md' '--bundle' 'generated/codex-project-bundle-1' '--output' '<output.pdf>'",
          },
        },
        diagnostics: [
          {
            conditionId: "MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED",
            severity: "warning",
            context: {
              kind: "occupied-page-number-slot",
              position: "bottom-right",
              area: "footer",
              slot: "right",
            },
            message: privateDiagnostic,
          },
          {
            conditionId: "MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION",
            severity: "warning",
            context: {
              kind: "legacy-pages-token-migration",
              countFrom: "body",
              declaredRevision: 2,
            },
            message: `Migration ${escape}[31mwarning${escape}[0m${bell}`,
          },
        ],
        capabilityRequirements: [
          {
            capabilityId: "pageNumbers.start",
            requestedBy: ["pageNumbers.start"],
            minimumVersion: "65.1",
          },
          {
            capabilityId: "pageNumbers.increment",
            requestedBy: ["pageNumbers.increment"],
            minimumVersion: "65.1",
          },
          {
            capabilityId: "pageNumbers.countFrom.body",
            requestedBy: ["pageNumbers.countFrom"],
            minimumVersion: "65.1",
          },
        ],
      },
      selectQueue: [...recipesCodexSelections("project-bundle"), "continue", "cancel"],
      inputQueue: [""],
      confirmQueue: [false, true],
    });

    expect(result.stderr).toContain("Contained Profile:");
    expect(result.stderr).toContain("Effective page numbers: enabled=yes, scope=body");
    expect(result.stderr).toContain("pageNumbers.countFrom.body (minimum 65.1");
    expect(result.stderr).toContain("Template presentation:");
    expect(result.stderr).toContain("Template HTML: template.html");
    expect(result.stderr).toContain("Stylesheet: style.css");
    expect(result.stderr).toContain("Project orchestration:");
    expect(result.stderr).toContain("Project artifacts: planned");
    expect(result.stderr).toContain("Follow-up render usability: planned");
    expect(result.stderr).toContain("MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED");
    expect(result.stderr.match(/MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED/g)).toHaveLength(1);
    expect(result.stderr).toContain("MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION");
    expect(result.stderr.match(/MARKDOWN_PDF_LEGACY_PAGES_TOKEN_MIGRATION/g)).toHaveLength(1);
    expect(result.stderr).toContain("Follow-up render: cdx-chores");
    expect(result.stderr).not.toContain("--enable-page-numbers");
    expect(result.stderr).not.toContain("--disable-page-numbers");
    expect(result.stderr).toContain("[redacted-path]");
    expect(result.stderr).not.toContain("/Users/alice/private");
    expect(result.stderr).not.toContain(privateDiagnostic);
    expect(result.stderr).not.toContain(escape);
    expect(result.stderr).not.toContain(bell);
    expect(result.stderr).toContain("\\u001b");
    expect(result.stderr).toContain("\\u0007");
  });

  test("reviews disabled Project page numbers without capabilities or override flags", () => {
    const result = runInteractiveHarness({
      mode: "run",
      markdownPdfMocks: true,
      markdownPdfCodexFinalProfile: {
        pageNumbers: {
          enabled: false,
          scope: "document",
          countFrom: "document",
          start: 0,
          increment: 2,
          position: "bottom-center",
          format: "{page}",
        },
      },
      markdownPdfCodexProjectHandoff: {
        profile: {
          id: "md-pdf-profile-20260101T000000Z-abc12345",
          bundlePath: "profile.yml",
        },
        artifacts: { availability: "planned" },
        render: {
          usability: "planned",
          command: {
            executable: "cdx-chores",
            args: [
              "md",
              "to-pdf",
              "--input",
              "client's report.md",
              "--bundle",
              "generated/project bundle",
              "--output",
              "<output.pdf>",
            ],
            display:
              "cdx-chores 'md' 'to-pdf' '--input' 'client'\\''s report.md' '--bundle' 'generated/project bundle' '--output' '<output.pdf>'",
          },
        },
        diagnostics: [],
        capabilityRequirements: [],
      },
      selectQueue: [...recipesCodexSelections("project-bundle"), "continue", "cancel"],
      inputQueue: [""],
      confirmQueue: [false, true],
    });

    expect(result.stderr).toContain(
      "Effective page numbers: enabled=no, scope=document, countFrom=document, start=0, increment=2",
    );
    expect(result.stderr).toContain("Capability requirements: none");
    expect(result.stderr).not.toContain("Project warning [");
    expect(result.stderr).toContain("'--input' 'client'\\''s report.md'");
    expect(result.stderr).toContain("'--bundle' 'generated/project bundle'");
    for (const forbiddenFlag of [
      "--profile",
      "--template",
      "--css",
      "--enable-page-numbers",
      "--disable-page-numbers",
    ]) {
      expect(result.stderr).not.toContain(forbiddenFlag);
    }
  });
});
