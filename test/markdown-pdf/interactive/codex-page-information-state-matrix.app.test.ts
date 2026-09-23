import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { createMarkdownPdfPageInformationPreparationSession } from "../../../src/cli/interactive/markdown/codex-page-information-preparation";
import {
  bindMarkdownPdfCodexCandidate,
  writeBoundMarkdownPdfCodexCandidate,
} from "../../../src/cli/interactive/markdown/codex-service";
import type { MarkdownPdfCodexSetup } from "../../../src/cli/interactive/markdown/codex-types";
import { readMarkdownPdfProfileFile } from "../../../src/cli/markdown-pdf/profile";
import { createActionTestRuntime } from "../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";
import { minimalPng } from "../actions/template-codex/fixtures";

type State = "unspecified" | "off" | "on";
const states: State[] = ["unspecified", "off", "on"];

function pageInformation(
  numbers: State,
  repeating: State,
): MarkdownPdfCodexSetup["pageInformation"] {
  if (numbers === "unspecified" && repeating === "unspecified") return undefined;
  return {
    ...(numbers === "unspecified"
      ? {}
      : {
          pageNumbers: {
            enabled: numbers === "on",
            scope: "body" as const,
            countFrom: "body" as const,
            start: 1,
            increment: 1,
            position: "bottom-center" as const,
            format: " Exact {page} ",
          },
        }),
    ...(repeating === "unspecified"
      ? {}
      : {
          repeatingContent:
            repeating === "off"
              ? { enabled: false as const, selected: [], text: {} }
              : {
                  enabled: true as const,
                  selected: ["top-left" as const],
                  text: { "top-left": "Exact {title}" },
                },
        }),
  };
}

describe("Interactive page-information saved-state matrix", () => {
  for (const artifact of ["profile", "project-bundle"] as const) {
    for (const hasBase of [false, true]) {
      for (const numbers of states) {
        for (const repeating of states) {
          test(`${artifact}, ${hasBase ? "base" : "fresh"}, numbers ${numbers}, text ${repeating}`, async () => {
            await withTempFixtureDir("md-pdf-page-state-matrix", async (fixtureDir) => {
              if (hasBase) {
                await writeFile(
                  join(fixtureDir, "base.yml"),
                  [
                    "pageNumbers:",
                    "  enabled: true",
                    "  scope: body",
                    "  countFrom: body",
                    "  position: bottom-center",
                    "  format: 'Base {page}'",
                    "header:",
                    "  left: Base header",
                    "footer:",
                    "  right: Base footer",
                    "fonts:",
                    "  pageChrome:",
                    "    default: Example Serif",
                    "",
                  ].join("\n"),
                  "utf8",
                );
              }
              if (artifact === "project-bundle") {
                await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));
              }
              const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
              let consentCalls = 0;
              let modelCalls = 0;
              const session = createMarkdownPdfPageInformationPreparationSession(runtime, {
                confirmRequest: async () => {
                  consentCalls += 1;
                  return true;
                },
                internalProfileCodexRunner: async () => {
                  modelCalls += 1;
                  throw new Error("Unexpected Profile model request");
                },
                internalTemplateCodexRunner: async () => {
                  modelCalls += 1;
                  throw new Error("Unexpected Template model request");
                },
              });
              const prepared = await session.prepare({
                artifact,
                ...(hasBase ? { baseProfile: "base.yml" } : {}),
                ...(artifact === "project-bundle" ? { coverImage: "cover.png" } : {}),
                fontHints: [],
                pageInformation: pageInformation(numbers, repeating),
              });
              expect(prepared.kind).toBe("prepared");
              expect(consentCalls).toBe(0);
              expect(modelCalls).toBe(0);
              if (prepared.kind !== "prepared") return;
              expect(prepared.plan.profileMode).toBe("deterministic");
              if (artifact === "project-bundle") {
                expect(prepared.plan.projectMode).toBe("deterministic");
              }

              const output = artifact === "profile" ? "saved.yml" : "saved-project";
              const bound = await bindMarkdownPdfCodexCandidate(runtime, prepared.candidate, {
                output,
                overwrite: false,
                report: { kind: "none" },
              });
              await writeBoundMarkdownPdfCodexCandidate(runtime, bound);
              const profilePath = join(
                fixtureDir,
                artifact === "profile" ? output : `${output}/profile.yml`,
              );
              const saved = await readMarkdownPdfProfileFile(profilePath);
              expect(saved.pageNumbers).toMatchObject({
                enabled: numbers === "on" || (numbers === "unspecified" && hasBase),
              });
              if (numbers === "on") {
                expect(saved.pageNumbers).toMatchObject({
                  format: " Exact {page} ",
                  position: "bottom-center",
                });
              } else if (hasBase) {
                expect(saved.pageNumbers).toMatchObject({ format: "Base {page}" });
              }
              if (repeating === "unspecified" && !hasBase) {
                expect(saved.header).toEqual({});
                expect(saved.footer).toEqual({});
              } else {
                expect(saved.header).toMatchObject({
                  left:
                    repeating === "on"
                      ? "Exact {title}"
                      : repeating === "unspecified"
                        ? "Base header"
                        : "",
                });
                expect(saved.footer).toMatchObject({
                  right: repeating === "unspecified" && hasBase ? "Base footer" : "",
                });
              }
              if (hasBase) {
                expect(saved.fonts).toMatchObject({
                  pageChrome: { default: "Example Serif" },
                });
              }
              if (artifact === "project-bundle") {
                expect(await readFile(join(fixtureDir, output, "template.html"), "utf8")).toContain(
                  "$body$",
                );
                if (prepared.candidate.artifact === "project-bundle") {
                  expect(prepared.candidate.prepared.profilePhase.finalProfile).toMatchObject(
                    saved,
                  );
                }
              }
            });
          });
        }
      }
    }
  }
});
