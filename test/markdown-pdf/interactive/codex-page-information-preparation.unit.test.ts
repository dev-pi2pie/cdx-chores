import { describe, expect, test } from "bun:test";

import type { CliRuntime } from "../../../src/cli/types";
import {
  createMarkdownPdfPageInformationPreparationSession,
  escapeMarkdownPdfPageInformationTerminalText,
  planMarkdownPdfPageInformationRequest,
  renderMarkdownPdfPageInformationConsent,
} from "../../../src/cli/interactive/markdown/codex-page-information-preparation";
import type {
  MarkdownPdfCodexSetup,
  PreparedMarkdownPdfCodexCandidate,
} from "../../../src/cli/interactive/markdown/codex-types";
import type { MarkdownPdfCodexPageInformationAnswers } from "../../../src/cli/interactive/markdown/codex-page-information";
import { bindMarkdownPdfCodexCandidate } from "../../../src/cli/interactive/markdown/codex-service";

const pageInformation: MarkdownPdfCodexPageInformationAnswers = {
  pageNumbers: {
    enabled: true,
    scope: "body",
    countFrom: "body",
    start: 1,
    increment: 1,
    position: "bottom-center",
    format: "Page {page}",
  },
  repeatingContent: {
    enabled: true,
    selected: ["top-left"],
    text: { "top-left": "{title}" },
  },
};

function setup(
  artifact: "profile" | "project-bundle",
  override: Partial<MarkdownPdfCodexSetup> = {},
): MarkdownPdfCodexSetup {
  return { artifact, fontHints: [], pageInformation, ...override };
}

function runtime(colorEnabled = false, isTTY = false) {
  const chunks: string[] = [];
  const stream = {
    isTTY,
    write(chunk: string) {
      chunks.push(String(chunk));
      return true;
    },
  } as unknown as NodeJS.WritableStream;
  return {
    runtime: { colorEnabled, stderr: stream, stdout: stream } as CliRuntime,
    output: () => chunks.join(""),
  };
}

function candidate(artifact: "profile" | "project-bundle"): PreparedMarkdownPdfCodexCandidate {
  if (artifact === "profile") {
    return { artifact, prepared: {} as never, setup: setup(artifact) };
  }
  return {
    artifact,
    prepared: {
      profilePhase: { phase: { signalMode: "basic-default" } },
      templatePhase: { phase: { signalMode: "deterministic" } },
    } as never,
    setup: setup(artifact),
  };
}

describe("internal Markdown PDF page-information preparation", () => {
  test("classifies page-information-only Profile and Project as deterministic", () => {
    expect(planMarkdownPdfPageInformationRequest(setup("profile"))).toMatchObject({
      profileMode: "deterministic",
      needsConsent: false,
    });
    expect(
      planMarkdownPdfPageInformationRequest(setup("profile", { pageInformation: {} })),
    ).toMatchObject({
      pageInformation: undefined,
      profileMode: "deterministic",
      needsConsent: false,
    });
    expect(planMarkdownPdfPageInformationRequest(setup("project-bundle"))).toMatchObject({
      profileMode: "deterministic",
      projectMode: "deterministic",
      needsConsent: false,
    });
    expect(
      planMarkdownPdfPageInformationRequest(setup("project-bundle", { pageInformation: {} })),
    ).toMatchObject({ projectMode: "too-low-signal", needsConsent: false });
  });

  test("does not ask consent for a deterministic run and reports actual phase modes", async () => {
    const { runtime: cli, output } = runtime();
    const events: string[] = [];
    const session = createMarkdownPdfPageInformationPreparationSession(cli, {
      confirmRequest: async () => {
        events.push("consent");
        return true;
      },
      prepareCandidate: async (_runtime, input, options) => {
        events.push("prepare");
        if (!options) throw new Error("Missing preparation options");
        expect(options.internalPageInformation).toBe(input.pageInformation);
        return candidate("project-bundle");
      },
    });
    const result = await session.prepare(setup("project-bundle"));
    expect(result.kind).toBe("prepared");
    expect(events).toEqual(["prepare"]);
    expect(output()).toContain("Profile phase: basic-default");
    expect(output()).toContain("Template phase: deterministic");
    expect(output()).not.toContain("Codex Assistant preparation");
  });

  test("shows exact active text safely before requesting consent and forwards one model choice", async () => {
    const { runtime: cli, output } = runtime(true, true);
    const events: string[] = [];
    const selection = { model: "test-model", reasoningEffort: "high" as const };
    const consentInput = setup("profile", {
      intent: "Adjust typography",
      pageInformation: {
        pageNumbers: {
          ...pageInformation.pageNumbers!,
          format: "Label\u001b\u0085\u202e\u2028\u2029",
        },
        repeatingContent: {
          enabled: true,
          selected: ["top-left"],
          text: { "top-left": "Exact {title}\nline" },
        },
      },
    });
    const executions: unknown[] = [];
    const session = createMarkdownPdfPageInformationPreparationSession(cli, {
      codexExecution: selection,
      confirmRequest: async () => {
        events.push("consent");
        expect(output()).toContain("Page-number label: Label\\u001b\\u0085\\u202e\\u2028\\u2029");
        expect(output()).toContain("top-left: Exact {title}\\u000aline");
        return true;
      },
      prepareCandidate: async (_runtime, _input, options) => {
        events.push("prepare");
        if (!options) throw new Error("Missing preparation options");
        executions.push(options.codexExecution);
        return candidate("profile");
      },
    });
    await session.prepare(consentInput);
    await session.prepare(consentInput);
    expect(events).toEqual(["consent", "prepare", "consent", "prepare"]);
    expect(executions[0]).toBe(executions[1]);
    expect(executions[0]).toEqual({ model: "test-model", reasoningEffort: "high" });
    expect(output()).not.toContain("\u0085");
    expect(output()).not.toContain("\u202e");
    expect(output()).not.toContain("\u2028");
    expect(output()).not.toContain("\u2029");
  });

  test("declining consent prevents preparation", async () => {
    const { runtime: cli } = runtime();
    const session = createMarkdownPdfPageInformationPreparationSession(cli, {
      confirmRequest: async () => false,
      prepareCandidate: async () => {
        throw new Error("Preparation must not run without consent");
      },
    });
    expect(
      await session.prepare(setup("profile", { intent: "Use a compact layout" })),
    ).toMatchObject({
      kind: "declined",
    });
  });

  test("binding an internal page-information candidate cannot retain a diagnostic report", async () => {
    const { runtime: cli } = runtime();
    await expect(
      bindMarkdownPdfCodexCandidate(cli, candidate("profile"), {
        output: "unused.yml",
        overwrite: false,
        report: { kind: "with-artifact" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  test("escapes controls and format characters without changing ordinary page text", () => {
    expect(escapeMarkdownPdfPageInformationTerminalText("Page {page} / Archive")).toBe(
      "Page {page} / Archive",
    );
    expect(escapeMarkdownPdfPageInformationTerminalText("A\tB\nC\u0085\u202e\u2028\u2029")).toBe(
      "A\\u0009B\\u000aC\\u0085\\u202e\\u2028\\u2029",
    );
  });

  test("styles only fixed consent headings on an eligible stderr TTY", () => {
    const input = setup("project-bundle", {
      intent: "Use exact {title}",
      fontHints: ["Page headers and footers"],
    });
    const plan = planMarkdownPdfPageInformationRequest(input);
    const plain = runtime(false, true);
    const styled = runtime(true, true);
    renderMarkdownPdfPageInformationConsent(plain.runtime, input, plan);
    renderMarkdownPdfPageInformationConsent(styled.runtime, input, plan);
    expect(styled.output()).toContain("\u001b[");
    const ansiStyles = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");
    expect(styled.output().replace(ansiStyles, "")).toBe(plain.output());
    expect(plain.output()).toContain("Intent: Use exact {title}");
    expect(plain.output()).toContain("Font hints:\n- Page headers and footers");
    expect(plain.output()).toContain("a Template request may follow if needed");
  });
});
