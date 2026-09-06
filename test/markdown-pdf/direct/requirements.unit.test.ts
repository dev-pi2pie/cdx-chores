import { describe, expect, test } from "bun:test";

import { assessCommandMinimumVersion, type CommandStatus } from "../../../src/cli/deps";
import {
  MARKDOWN_PDF_MINIMUM_PANDOC_VERSION,
  assessMarkdownPdfRequirements,
} from "../../../src/cli/markdown-pdf/requirements";

function commandStatus(
  name: string,
  options: { available?: boolean; version?: string | null } = {},
): CommandStatus {
  return {
    name,
    available: options.available ?? true,
    version: options.version ?? null,
    installHint: `install ${name}`,
  };
}

describe("Markdown PDF dependency requirements", () => {
  test("compares dotted numeric Pandoc versions without SemVer assumptions", () => {
    const versions = [
      ["1.19.2", "unsupported"],
      ["2.0", "satisfied"],
      ["2.0.0", "satisfied"],
      ["2.0.1", "satisfied"],
      ["3.1.11.1", "satisfied"],
    ] as const;

    for (const [version, expectedStatus] of versions) {
      expect(
        assessCommandMinimumVersion(
          commandStatus("pandoc", { version }),
          MARKDOWN_PDF_MINIMUM_PANDOC_VERSION,
        ),
      ).toEqual({
        status: expectedStatus,
        available: true,
        version,
        minimumVersion: "2.0",
      });
    }
  });

  test("distinguishes missing and unverified Pandoc versions", () => {
    expect(
      assessCommandMinimumVersion(
        commandStatus("pandoc", { available: false }),
        MARKDOWN_PDF_MINIMUM_PANDOC_VERSION,
      ),
    ).toEqual({
      status: "missing",
      available: false,
      version: null,
      minimumVersion: "2.0",
    });
    expect(
      assessCommandMinimumVersion(
        commandStatus("pandoc", { version: "custom-build" }),
        MARKDOWN_PDF_MINIMUM_PANDOC_VERSION,
      ),
    ).toEqual({
      status: "unverified",
      available: true,
      version: "custom-build",
      minimumVersion: "2.0",
    });
  });

  test("requires supported Pandoc and available WeasyPrint together", () => {
    const supportedPandoc = commandStatus("pandoc", { version: "3.9" });
    const unsupportedPandoc = commandStatus("pandoc", { version: "1.19.2" });
    const unverifiedPandoc = commandStatus("pandoc", { version: "custom-build" });
    const missingPandoc = commandStatus("pandoc", { available: false });
    const weasyprint = commandStatus("weasyprint", { version: "68.0" });
    const missingWeasyprint = commandStatus("weasyprint", { available: false });

    expect(assessMarkdownPdfRequirements(supportedPandoc, weasyprint).ready).toBe(true);
    expect(assessMarkdownPdfRequirements(unsupportedPandoc, weasyprint)).toMatchObject({
      ready: false,
      requirements: { pandoc: { status: "unsupported" } },
    });
    expect(assessMarkdownPdfRequirements(unverifiedPandoc, weasyprint)).toMatchObject({
      ready: false,
      requirements: { pandoc: { status: "unverified" } },
    });
    expect(assessMarkdownPdfRequirements(missingPandoc, weasyprint)).toMatchObject({
      ready: false,
      requirements: { pandoc: { status: "missing" } },
    });
    expect(assessMarkdownPdfRequirements(supportedPandoc, missingWeasyprint)).toMatchObject({
      ready: false,
      requirements: { weasyprint: { status: "missing" } },
    });
  });
});
