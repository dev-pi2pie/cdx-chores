import { describe, expect, test } from "bun:test";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdPdfProfileInit } from "../src/cli/actions";
import {
  bindPreparedMarkdownPdfProfileInitDestination,
  prepareMarkdownPdfProfileInit,
  writePreparedMarkdownPdfProfileInit,
} from "../src/cli/markdown-pdf/profile/init-service";
import { normalizeMarkdownPdfOptions } from "../src/cli/markdown-pdf/validation";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli action modules: md to-pdf profile init", () => {
  test("writes a default YAML profile file", async () => {
    await withTempFixtureDir("md-pdf-profile-action", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-profile.yml");
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdPdfProfileInit(runtime, {
        output: toRepoRelativePath(outputPath),
      });

      const profile = await readFile(outputPath, "utf8");
      expect(profile).toContain("page:");
      expect(profile).not.toContain("profile:");
      expect(profile).toContain("pageNumbers:");
      expect(profile).toContain("enabled: false");
      expect(profile).toContain("scope: body");
      expect(profile).toContain("countFrom: document");
      expect(profile).toContain("start: 1");
      expect(profile).toContain("increment: 1");
      expect(profile).toContain("position: bottom-center");
      expect(profile).toContain('format: "{page}"');
      expect(profile).not.toContain("style:");
      expect(stdout.text).toContain("Wrote Markdown PDF profile:");
      expectNoStderr();
    });
  });

  test("writes a JSON profile file with preset-derived values", async () => {
    await withTempFixtureDir("md-pdf-profile-action", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-profile.json");
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdPdfProfileInit(runtime, {
        output: toRepoRelativePath(outputPath),
        preset: "wide-table",
      });

      const profile = JSON.parse(await readFile(outputPath, "utf8")) as {
        page: { orientation: string; marginTop: string };
        pageNumbers: {
          enabled: boolean;
          scope: string;
          countFrom: string;
          start: number;
          increment: number;
          position: string;
          format: string;
        };
      };
      expect(profile.page.orientation).toBe("landscape");
      expect(profile.page.marginTop).toBe("12mm");
      expect(profile.pageNumbers).toEqual({
        enabled: false,
        scope: "body",
        countFrom: "document",
        start: 1,
        increment: 1,
        position: "bottom-center",
        format: "{page}",
      });
      expectNoStderr();
    });
  });

  test("matches the direct action when writing the same accepted profile", async () => {
    await withTempFixtureDir("md-pdf-profile-action", async (fixtureDir) => {
      const directOutputPath = join(fixtureDir, "direct-profile.yml");
      const preparedOutputPath = join(fixtureDir, "prepared-profile.yml");
      const direct = createActionTestRuntime();
      const preparedRuntime = createActionTestRuntime();
      const deterministicOptions = {
        marginX: "14mm",
        orientation: "landscape",
        preset: "report",
        toc: true,
        tocDepth: 4,
      };

      await actionMdPdfProfileInit(direct.runtime, {
        ...deterministicOptions,
        output: toRepoRelativePath(directOutputPath),
      });

      const prepared = prepareMarkdownPdfProfileInit(
        normalizeMarkdownPdfOptions(deterministicOptions),
      );
      const destination = bindPreparedMarkdownPdfProfileInitDestination(
        preparedRuntime.runtime,
        prepared,
        { output: toRepoRelativePath(preparedOutputPath) },
      );
      await writePreparedMarkdownPdfProfileInit(destination);

      expect(await readFile(preparedOutputPath, "utf8")).toBe(
        await readFile(directOutputPath, "utf8"),
      );
      expect(preparedRuntime.stdout.text).toBe("");
      direct.expectNoStderr();
      preparedRuntime.expectNoStderr();
    });
  });

  test("accepts normalized code settings without changing omitted direct defaults", () => {
    const normalizedOptions = normalizeMarkdownPdfOptions();
    const directEquivalent = prepareMarkdownPdfProfileInit(normalizedOptions);
    const customized = prepareMarkdownPdfProfileInit(normalizedOptions, {
      code: {
        highlight: true,
        theme: "vitesse-light",
        lineNumbers: true,
        transformerNotation: true,
      },
    });

    expect(directEquivalent.profile.code).toEqual({
      highlight: false,
      theme: "github-light",
      lineNumbers: false,
      transformerNotation: false,
    });
    expect(customized.profile).toEqual({
      ...directEquivalent.profile,
      code: {
        highlight: true,
        theme: "vitesse-light",
        lineNumbers: true,
        transformerNotation: true,
      },
    });
  });

  test("copies only supported defined Profile fields from runtime input", () => {
    const normalizedOptions = normalizeMarkdownPdfOptions();
    const directEquivalent = prepareMarkdownPdfProfileInit(normalizedOptions);
    const runtimeInput = {
      code: undefined,
      header: undefined,
      footer: undefined,
      pageNumbers: {
        enabled: false,
        scope: "body",
        countFrom: "document",
        start: 0,
        increment: 1,
        position: "bottom-center",
        format: "{page}",
      },
      unexpected: "must not be copied",
    } as const;
    const prepared = prepareMarkdownPdfProfileInit(normalizedOptions, runtimeInput as never);

    expect(prepared.profile).toEqual({
      ...directEquivalent.profile,
      pageNumbers: runtimeInput.pageNumbers,
    });
    expect(prepared.profile).not.toHaveProperty("unexpected");
    expect(prepared.profile.pageNumbers).not.toBe(runtimeInput.pageNumbers);
  });

  test("prepares once and rebinds YAML and JSON destinations without writing", async () => {
    await withTempFixtureDir("md-pdf-profile-action", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      const prepared = prepareMarkdownPdfProfileInit(
        normalizeMarkdownPdfOptions({ preset: "wide-table", toc: true }),
      );
      const acceptedProfile = structuredClone(prepared.profile);

      const yamlDestination = bindPreparedMarkdownPdfProfileInitDestination(runtime, prepared, {
        output: "profile.yml",
      });
      const jsonDestination = bindPreparedMarkdownPdfProfileInitDestination(runtime, prepared, {
        output: "profile.json",
      });

      expect(yamlDestination.prepared).toBe(prepared);
      expect(jsonDestination.prepared).toBe(prepared);
      expect(yamlDestination.format).toBe("yaml");
      expect(jsonDestination.format).toBe("json");
      expect(yamlDestination.serializedProfile).toContain("orientation: landscape");
      expect(JSON.parse(jsonDestination.serializedProfile)).toEqual(acceptedProfile);
      expect(prepared.profile).toEqual(acceptedProfile);
      expect(await readdir(fixtureDir)).toEqual([]);
      expectNoOutput();
    });
  });

  test("writes the bound accepted profile without regenerating it", async () => {
    await withTempFixtureDir("md-pdf-profile-action", async (fixtureDir) => {
      const { runtime, expectNoStderr } = createActionTestRuntime({ cwd: fixtureDir });
      const prepared = prepareMarkdownPdfProfileInit(
        normalizeMarkdownPdfOptions({ orientation: "landscape", preset: "report" }),
      );
      const acceptedProfile = structuredClone(prepared.profile);
      const destination = bindPreparedMarkdownPdfProfileInitDestination(runtime, prepared, {
        output: "accepted-profile.json",
      });

      prepared.normalizedOptions.orientation = "portrait";
      await writePreparedMarkdownPdfProfileInit(destination);

      expect(JSON.parse(await readFile(destination.outputPath, "utf8"))).toEqual(acceptedProfile);
      expectNoStderr();
    });
  });

  test("rejects unknown profile extensions", async () => {
    await withTempFixtureDir("md-pdf-profile-action", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-profile.txt");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdPdfProfileInit(runtime, {
            output: toRepoRelativePath(outputPath),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "must end with .yml, .yaml, or .json",
        },
      );

      expectNoOutput();
    });
  });

  test("refuses an existing profile file without overwrite", async () => {
    await withTempFixtureDir("md-pdf-profile-action", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-profile.yml");
      await writeFile(outputPath, "existing", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdPdfProfileInit(runtime, {
            output: toRepoRelativePath(outputPath),
          }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "Output file already exists",
        },
      );

      expectNoOutput();
    });
  });
});
