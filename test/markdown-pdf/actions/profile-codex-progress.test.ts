import {
  actionMdPdfProfileCodex,
  adaptedRunner,
  afterEach,
  createActionTestRuntime,
  describe,
  expect,
  expectCliError,
  join,
  mock,
  test,
  withTempFixtureDir,
  writeFile,
} from "./profile-codex-fixtures";
import type { CodexProgressPresenter } from "./profile-codex-fixtures";

afterEach(() => {
  mock.restore();
});

describe("Markdown PDF Profile Codex progress", () => {
  test("shows and clears TTY Codex progress on success", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-progress-success", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime, stdout, stderr } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
      await actionMdPdfProfileCodex(runtime, {
        codexRunner: adaptedRunner("article"),
        dryRun: true,
        input: "report.md",
        intent: "article profile",
        output: "profile.yml",
      });

      expect(stderr.text).toContain(
        "\r\u001b[2KRequesting Codex Markdown PDF profile recommendation... -",
      );
      expect(stderr.text).toContain(
        "\r\u001b[2KRequesting Codex Markdown PDF profile recommendation... done\n",
      );
      expect(stdout.text).toContain("Decision: adapted");
    });
  });

  test("uses an injected Codex progress presenter without direct progress output", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-progress-injected", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");
      const events: string[] = [];
      const codexProgressPresenter: CodexProgressPresenter = {
        start: (label) => events.push(`start:${label}`),
        update: (label) => events.push(`update:${label}`),
        stop: (status) => events.push(`stop:${status}`),
      };
      const { runtime, stderr } = createActionTestRuntime({ cwd: fixtureDir });

      await actionMdPdfProfileCodex(runtime, {
        codexProgressPresenter,
        codexRunner: adaptedRunner("article"),
        dryRun: true,
        input: "report.md",
        intent: "article profile",
        output: "profile.yml",
      });

      expect(events).toEqual([
        "start:Requesting Codex Markdown PDF profile recommendation",
        "stop:done",
      ]);
      expect(stderr.text).not.toContain("Requesting Codex Markdown PDF profile recommendation");
    });
  });

  test("shows and clears TTY Codex progress on errors", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-progress-error", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime, stderr } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexRunner: async () => {
              throw new Error("network unavailable");
            },
            input: "report.md",
            intent: "article profile",
            output: "profile.yml",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_FAILED",
          exitCode: 1,
          messageIncludes: "unavailable",
        },
      );

      expect(stderr.text).toContain(
        "\r\u001b[2KRequesting Codex Markdown PDF profile recommendation... -",
      );
      expect(stderr.text).toContain(
        "\r\u001b[2KRequesting Codex Markdown PDF profile recommendation... error\n",
      );
    });
  });

  test("shows fallback TTY Codex progress for conservative fallback decisions", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-progress-fallback", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime, stdout, stderr } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
      await actionMdPdfProfileCodex(runtime, {
        codexRunner: async () =>
          JSON.stringify({
            decision_mode: "conservative-fallback",
            selected_candidate_id: "default",
            accepted_patches: [],
            accepted_font_patches: [],
            reasoning: "Facts are weak.",
            warnings: ["Using default profile."],
            fallback_reason: "No strong layout signal.",
            unmatched_directions: [],
          }),
        dryRun: true,
        input: "report.md",
        intent: "unclear profile",
        output: "profile.yml",
      });

      expect(stderr.text).toContain(
        "\r\u001b[2KRequesting Codex Markdown PDF profile recommendation... fallback\n",
      );
      expect(stderr.text).not.toContain(
        "\r\u001b[2KRequesting Codex Markdown PDF profile recommendation... error\n",
      );
      expect(stdout.text).toContain("Decision: conservative-fallback");
    });
  });

  test("shows one error TTY Codex progress stop for no usable profile decisions", async () => {
    await withTempFixtureDir("md-pdf-profile-codex-progress-no-usable", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime, stderr } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-15T08:15:00.000Z"),
      });
      (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
      await expectCliError(
        () =>
          actionMdPdfProfileCodex(runtime, {
            codexRunner: async () =>
              JSON.stringify({
                decision_mode: "no-usable-profile",
                selected_candidate_id: "none",
                accepted_patches: [],
                accepted_font_patches: [],
                reasoning: "No reusable profile fits.",
                warnings: [],
                fallback_reason: "Unsupported custom layout request.",
                unmatched_directions: ["custom layout"],
              }),
            input: "report.md",
            intent: "custom layout",
            output: "profile.yml",
          }),
        {
          code: "MARKDOWN_PDF_CODEX_NO_USABLE_PROFILE",
          exitCode: 1,
          messageIncludes: "did not find a usable",
        },
      );

      const errorStop =
        "\r\u001b[2KRequesting Codex Markdown PDF profile recommendation... error\n";
      const errorStops = stderr.text.split(errorStop).length - 1;
      expect(errorStops).toBe(1);
    });
  });
});
