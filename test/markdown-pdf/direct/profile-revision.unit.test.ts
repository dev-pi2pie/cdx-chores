import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { prepareMarkdownPdfRender } from "../../../src/cli/actions/markdown/to-pdf-service";
import {
  assessMarkdownPdfProfileRevision,
  collectMarkdownPdfDiagnostics,
  createMarkdownPdfProfileConfig,
  DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
  inferMarkdownPdfProfileRevision,
  MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS,
  MARKDOWN_PDF_PROFILE_CURRENT_REVISION,
  MARKDOWN_PDF_PROFILE_FEATURE_REGISTRY,
  MARKDOWN_PDF_PROFILE_SUPPORTED_SCHEMA_SUMMARY,
  normalizeMarkdownPdfOptions,
  normalizeMarkdownPdfProfile,
  readMarkdownPdfProfileFile,
  type MarkdownPdfProfileRevisionAssessment,
} from "../../../src/cli/markdown-pdf";
import { materializeMarkdownPdfProfileCodexProfile } from "../../../src/cli/markdown-pdf/profile-codex";
import { MARKDOWN_PDF_PROFILE_NORMALIZATION_ROOTS } from "../../../src/cli/markdown-pdf/profile/normalize";
import { expectCliError, createActionTestRuntime } from "../../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../../helpers/cli-test-utils";

const PROVEN_TEMPLATE = { bodyBoundary: "proven" } as const;

function revisionDiagnostics(assessment: MarkdownPdfProfileRevisionAssessment) {
  return collectMarkdownPdfDiagnostics({
    pageNumbers: DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers,
    profile: DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
    profileRevision: assessment,
    templateCompatibility: PROVEN_TEMPLATE,
  });
}

describe("Markdown PDF Profile revision compatibility", () => {
  test("keeps one unique registry with the exact revision-3 key boundary", () => {
    expect(new Set(MARKDOWN_PDF_PROFILE_FEATURE_REGISTRY.map(({ path }) => path))).toHaveLength(
      MARKDOWN_PDF_PROFILE_FEATURE_REGISTRY.length,
    );
    expect(
      MARKDOWN_PDF_PROFILE_FEATURE_REGISTRY.filter(
        ({ introducedIn, revisionContribution }) =>
          introducedIn === 3 && revisionContribution !== false,
      ).map(({ path }) => path),
    ).toEqual([
      "header.style",
      "footer.style",
      "header.style.fontSize",
      "header.style.fontWeight",
      "header.style.lineHeight",
      "header.style.color",
      "header.style.separator",
      "header.style.separator.width",
      "header.style.separator.style",
      "header.style.separator.color",
      "header.style.separator.gap",
      "footer.style.fontSize",
      "footer.style.fontWeight",
      "footer.style.lineHeight",
      "footer.style.color",
      "footer.style.separator",
      "footer.style.separator.width",
      "footer.style.separator.style",
      "footer.style.separator.color",
      "footer.style.separator.gap",
      "pageNumbers.countFrom",
      "pageNumbers.start",
      "pageNumbers.increment",
    ]);
    expect(
      MARKDOWN_PDF_PROFILE_FEATURE_REGISTRY.find(({ path }) => path === "pageNumbers.scope")
        ?.values,
    ).toContainEqual({
      introducedIn: 3,
      rendererCapability: "pageNumbers.scope.document",
      value: "document",
    });
    expect(MARKDOWN_PDF_PROFILE_SUPPORTED_SCHEMA_SUMMARY).not.toContain("schemaVersion");
  });

  test("assigns every registered feature to a handled normalization owner", () => {
    for (const definition of MARKDOWN_PDF_PROFILE_FEATURE_REGISTRY) {
      const rootPath = definition.path.split(".", 1)[0]!;
      expect(
        MARKDOWN_PDF_PROFILE_NORMALIZATION_ROOTS[
          definition.normalizationRoute
        ] as readonly string[],
      ).toContain(rootPath);
    }
  });

  test("infers the revision-2 floor without counting declarations, defaults, or dynamic members", () => {
    for (const profile of [
      {},
      { schemaVersion: 3 },
      { metadata: { futureTeamLabel: "Example" } },
      { fonts: { body: { "zh-Hant": "Noto Serif TC" } } },
      { pageNumbers: { scope: "body" } },
    ]) {
      expect(inferMarkdownPdfProfileRevision(profile)).toBe(2);
      expect(normalizeMarkdownPdfProfile({ profile }).revisionAssessment.inferredRevision).toBe(2);
    }

    const withOverrides = normalizeMarkdownPdfProfile({
      frontmatter: { title: "Report", pdf: { "content-langs": ["en"] } },
      meta: ["company=Example"],
    });
    expect(withOverrides.revisionAssessment).toEqual({
      currentRevision: 3,
      inferredRevision: 2,
      state: "missing",
    });
  });

  test("infers revision 3 from every additive key family and the later scope value", () => {
    const revision3Profiles: Record<string, unknown>[] = [
      { pageNumbers: { countFrom: "document" } },
      { pageNumbers: { start: 0 } },
      { pageNumbers: { increment: 2 } },
      { pageNumbers: { scope: "document" } },
      { header: { style: {} } },
      { header: { style: { fontSize: "8pt" } } },
      { header: { style: { separator: { width: "1pt" } } } },
      { footer: { style: { color: "#123456" } } },
      { pageNumbers: { format: "{pdfPage}" } },
      { pageNumbers: { format: "{pdfPages}" } },
    ];

    for (const profile of revision3Profiles) {
      expect(inferMarkdownPdfProfileRevision(profile)).toBe(3);
      expect(normalizeMarkdownPdfProfile({ profile }).revisionAssessment.inferredRevision).toBe(3);
    }
  });

  test("infers format-token revisions from the serialized Profile only", () => {
    for (const format of ["{page}", "{pages}", "{Page}", "{pdfpages}", "{pdfPagesx}"]) {
      expect(inferMarkdownPdfProfileRevision({ pageNumbers: { format } })).toBe(2);
    }
    expect(
      inferMarkdownPdfProfileRevision({
        pageNumbers: { format: "{page}{pdfPage}{pdfPage}{pdfPages}" },
      }),
    ).toBe(3);
    expect(inferMarkdownPdfProfileRevision({ metadata: { label: "{pdfPages}" } })).toBe(2);
    expect(inferMarkdownPdfProfileRevision({ footer: { center: "{pdfPages}" } })).toBe(2);

    expect(
      MARKDOWN_PDF_PROFILE_FEATURE_REGISTRY.find(({ path }) => path === "pageNumbers.format")
        ?.tokens,
    ).toEqual([
      { introducedIn: 2, token: "page" },
      {
        introducedIn: 2,
        rendererCapability: "pageNumbers.logicalFinal",
        token: "pages",
      },
      {
        introducedIn: 3,
        rendererCapability: "pageNumbers.physicalCurrent",
        token: "pdfPage",
      },
      {
        introducedIn: 3,
        rendererCapability: "pageNumbers.physicalTotal",
        token: "pdfPages",
      },
    ]);
  });

  test("classifies missing, supported, stale, and forward declarations", () => {
    expect(assessMarkdownPdfProfileRevision({})).toEqual({
      currentRevision: 3,
      inferredRevision: 2,
      state: "missing",
    });
    expect(assessMarkdownPdfProfileRevision({ schemaVersion: 2 })).toEqual({
      currentRevision: 3,
      declaredRevision: 2,
      inferredRevision: 2,
      state: "supported",
    });
    expect(
      assessMarkdownPdfProfileRevision({ schemaVersion: 2, pageNumbers: { start: 0 } }),
    ).toEqual({
      currentRevision: 3,
      declaredRevision: 2,
      inferredRevision: 3,
      state: "stale",
    });
    expect(assessMarkdownPdfProfileRevision({ schemaVersion: 4 })).toEqual({
      currentRevision: 3,
      declaredRevision: 4,
      inferredRevision: 2,
      state: "forward",
    });
  });

  test("accepts only positive safe-integer runtime declarations without coercion", () => {
    expect(assessMarkdownPdfProfileRevision({ schemaVersion: 1.0 }).state).toBe("stale");
    expect(assessMarkdownPdfProfileRevision({ schemaVersion: 3 }).state).toBe("supported");

    for (const schemaVersion of [
      "3",
      true,
      null,
      {},
      [],
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      const result = normalizeMarkdownPdfProfile({ profile: { schemaVersion } });
      expect(result.revisionAssessment).toEqual({
        currentRevision: 3,
        inferredRevision: 2,
        state: "invalid",
      });
    }
  });

  test("emits one bounded advisory for invalid, stale, and forward declarations", () => {
    const cases = [
      [
        { schemaVersion: "3" },
        MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.profileSchemaVersionInvalid,
        "invalid",
      ],
      [
        { schemaVersion: 2, pageNumbers: { start: 0 } },
        MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.profileSchemaVersionStale,
        "stale",
      ],
      [
        { schemaVersion: 4 },
        MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.profileSchemaVersionForward,
        "forward",
      ],
    ] as const;

    for (const [profile, conditionId, state] of cases) {
      const assessment = normalizeMarkdownPdfProfile({ profile }).revisionAssessment;
      const diagnostics = revisionDiagnostics(assessment);
      expect(diagnostics.conditions).toHaveLength(1);
      expect(diagnostics.conditions[0]).toMatchObject({
        conditionId,
        context: {
          currentRevision: 3,
          inferredRevision: assessment.inferredRevision,
          kind: "profile-schema-version",
          state,
        },
        severity: "warning",
      });
    }

    expect(revisionDiagnostics(assessMarkdownPdfProfileRevision({}))).toEqual({ conditions: [] });
    expect(revisionDiagnostics(assessMarkdownPdfProfileRevision({ schemaVersion: 3 }))).toEqual({
      conditions: [],
    });
  });

  test("aggregates one revision advisory before enabled page-number advisories", () => {
    const profile = {
      ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
      footer: {
        ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.footer,
        center: "Existing footer",
      },
      pageNumbers: {
        ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers,
        enabled: true,
      },
    };
    const diagnostics = collectMarkdownPdfDiagnostics({
      pageNumbers: profile.pageNumbers,
      profile,
      profileRevision: assessMarkdownPdfProfileRevision({
        schemaVersion: 2,
        pageNumbers: { start: 0 },
      }),
      templateCompatibility: PROVEN_TEMPLATE,
    });
    expect(diagnostics.conditions.map(({ conditionId }) => conditionId)).toEqual([
      MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.profileSchemaVersionStale,
      MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.occupiedPageNumberSlot,
    ]);
  });

  test("does not expose an unusable raw declaration in structured diagnostics", () => {
    const diagnostic = revisionDiagnostics(
      assessMarkdownPdfProfileRevision({ schemaVersion: { private: "value" } }),
    ).conditions[0];
    expect(diagnostic?.context).toEqual({
      currentRevision: 3,
      inferredRevision: 2,
      kind: "profile-schema-version",
      state: "invalid",
    });
    expect(JSON.stringify(diagnostic)).not.toContain("private");
  });

  test("keeps actual supported keys, values, and combinations authoritative", async () => {
    await withTempFixtureDir("md-pdf-profile-revision-authority", async (fixtureDir) => {
      const unknownPath = join(fixtureDir, "unknown.yml");
      await writeFile(unknownPath, "schemaVersion: 99\nfutureFeature: true\n", "utf8");
      await expectCliError(() => readMarkdownPdfProfileFile(unknownPath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "profile.futureFeature",
      });

      expect(() =>
        normalizeMarkdownPdfProfile({
          profile: {
            schemaVersion: 99,
            pageNumbers: { scope: "document", countFrom: "body" },
          },
        }),
      ).toThrow("scope document cannot be used with countFrom body");

      expect(
        normalizeMarkdownPdfProfile({
          profile: { schemaVersion: 99, pageNumbers: { start: 0 } },
        }).profile.pageNumbers.start,
      ).toBe(0);
    });
  });

  test("writes revision 3 for generated and derived Profiles without retaining base declarations", () => {
    const generated = createMarkdownPdfProfileConfig(normalizeMarkdownPdfOptions());
    expect(generated.schemaVersion).toBe(MARKDOWN_PDF_PROFILE_CURRENT_REVISION);

    const base = { schemaVersion: 2, page: { size: "Letter" } };
    const baseSnapshot = structuredClone(base);
    const { finalProfile } = materializeMarkdownPdfProfileCodexProfile({
      identity: {
        id: "md-pdf-profile-20260814T000000Z-abc12345",
        source: "deterministic",
        basedOn: "legacy-base",
        createdAt: "2026-08-14T00:00:00Z",
      },
      profile: base,
    });
    expect(finalProfile.schemaVersion).toBe(3);
    expect(base).toEqual(baseSnapshot);
  });

  test("does not copy the declaration into normalized render behavior or rewrite its input", async () => {
    await withTempFixtureDir("md-pdf-profile-revision-no-rewrite", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const originalProfile = "schemaVersion: 99\npageNumbers:\n  enabled: false\n";
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, originalProfile, "utf8");
      const { runtime } = createActionTestRuntime();

      const prepared = await prepareMarkdownPdfRender(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
      });

      expect(Object.hasOwn(prepared.normalizedProfile, "schemaVersion")).toBe(false);
      expect(prepared.diagnostics.conditions).toHaveLength(1);
      expect(prepared.diagnostics.conditions[0]?.conditionId).toBe(
        MARKDOWN_PDF_DIAGNOSTIC_CONDITION_IDS.profileSchemaVersionForward,
      );
      expect(await readFile(profilePath, "utf8")).toBe(originalProfile);
    });
  });
});
