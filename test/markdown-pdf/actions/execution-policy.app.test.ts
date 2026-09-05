import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  actionMdPdfProfileCodex,
  actionMdPdfProjectCodex,
  actionMdPdfTemplateCodex,
} from "../../../src/cli/actions/markdown";
import { prepareMarkdownPdfProfileCodex } from "../../../src/cli/markdown-pdf/profile-codex";
import { prepareMdPdfProjectCodex } from "../../../src/cli/markdown-pdf/project-codex";
import { prepareMdPdfTemplateCodex } from "../../../src/cli/markdown-pdf/template-codex";
import { createActionTestRuntime } from "../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../helpers/cli-test-utils";
import { BASE_PROFILE, adaptedProfileResponse } from "./project-codex/prepared-fixtures";
import { noUsableResponse } from "../adapters/template-codex-fixtures";

const policy = { model: "Model-A", provider: "Provider-A", reasoningEffort: "high" } as const;

describe("Markdown service execution policy", () => {
  for (const [name, entry] of [
    ["profile action", actionMdPdfProfileCodex],
    ["template action", actionMdPdfTemplateCodex],
    ["project action", actionMdPdfProjectCodex],
    ["profile preparation", prepareMarkdownPdfProfileCodex],
    ["template preparation", prepareMdPdfTemplateCodex],
    ["project preparation", prepareMdPdfProjectCodex],
  ] as const) {
    test(`${name} rejects execution settings before input access`, async () => {
      let touched = false;
      const { runtime } = createActionTestRuntime({ cwd: "/fixtures" });
      await expect(
        entry(runtime, {
          codexExecution: { provider: " " },
          get input(): never {
            touched = true;
            throw new Error("Input read");
          },
        }),
      ).rejects.toThrow("provider");
      expect(touched).toBe(false);
    });
  }

  test("profile and template preparation retain explicit settings outside prepared artifacts", async () => {
    await withTempFixtureDir("markdown-execution", async (dir) => {
      await writeFile(join(dir, "base.yml"), BASE_PROFILE);
      await writeFile(join(dir, "report.md"), "# Report\n\nBody.\n");
      const { runtime } = createActionTestRuntime({ cwd: dir });
      let profileCalls = 0;
      let templateCalls = 0;
      const profile = await prepareMarkdownPdfProfileCodex(runtime, {
        input: "report.md",
        baseProfile: "base.yml",
        intent: "Create article profile",
        dryRun: true,
        output: "profile.yml",
        codexExecution: policy,
        codexRunner: async (options) => {
          profileCalls += 1;
          expect(options.codexExecution).toEqual(policy);
          return adaptedProfileResponse();
        },
      });
      const template = await prepareMdPdfTemplateCodex(runtime, {
        input: "report.md",
        intent: "Create custom layout",
        dryRun: true,
        output: "template-output",
        codexExecution: policy,
        codexRunner: async (options) => {
          templateCalls += 1;
          expect(options.codexExecution).toEqual(policy);
          return noUsableResponse();
        },
      });
      expect(profileCalls).toBe(1);
      expect(templateCalls).toBe(1);
      expect(JSON.stringify([profile, template])).not.toContain("Provider-A");
      expect(JSON.stringify([profile, template])).not.toContain("codexExecution");
    });
  });

  test("execution options alone do not change deterministic profile preparation into a request", async () => {
    await withTempFixtureDir("markdown-execution-deterministic", async (dir) => {
      const { runtime } = createActionTestRuntime({ cwd: dir });
      let calls = 0;
      const prepared = await prepareMarkdownPdfProfileCodex(runtime, {
        dryRun: true,
        codexExecution: policy,
        codexRunner: async () => {
          calls += 1;
          throw new Error("Unexpected request");
        },
      });
      expect(calls).toBe(0);
      expect(JSON.stringify(prepared)).not.toContain("codexExecution");
    });
  });
});
