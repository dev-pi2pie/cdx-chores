import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionFontCheck } from "../src/cli/actions";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { createTempFixtureDir } from "./helpers/cli-test-utils";

describe("font CLI check validation", () => {
  test("rejects invalid font check inputs before discovery", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();
    let called = false;
    const runner = async () => {
      called = true;
      return { ok: true, stdout: "", stderr: "" };
    };

    await expectCliError(() => actionFontCheck(runtime, { text: "A", runner }), {
      code: "INVALID_INPUT",
      exitCode: 2,
      messageIncludes: "--family is required for font check",
    });
    await expectCliError(() => actionFontCheck(runtime, { family: "Latin", runner }), {
      code: "INVALID_INPUT",
      exitCode: 2,
      messageIncludes: "requires exactly one of --text or --text-file",
    });
    await expectCliError(
      () => actionFontCheck(runtime, { family: "Latin", text: "A", textFile: "a.txt", runner }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "requires exactly one of --text or --text-file",
      },
    );
    await expectCliError(
      () => actionFontCheck(runtime, { family: "Latin", text: "A", require: "emoji", runner }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--require must be one of: nerd",
      },
    );
    expect(called).toBe(false);
    expectNoOutput();
  });

  test("reads font check text files as raw UTF-8 and filters only controls", async () => {
    const fixtureDir = await createTempFixtureDir("font-check-text");
    const textPath = join(fixtureDir, "sample.txt");
    await writeFile(textPath, Buffer.from([0xef, 0xbb, 0xbf, 0x41, 0x0a, 0x42, 0x09]));
    const { runtime, stdout, expectNoStderr } = createActionTestRuntime();
    runtime.platform = "linux";

    await actionFontCheck(runtime, {
      json: true,
      family: "Latin",
      textFile: textPath,
      discovery: "fontconfig",
      runner: async (command, args) => {
        if (command === "fc-list") {
          return {
            ok: true,
            stdout: "Latin\tLatin Regular\tRegular\t/fonts/Latin.ttf\n",
            stderr: "",
          };
        }
        return args[0] === "--version"
          ? { ok: true, stdout: "fontconfig version 2.15.0", stderr: "" }
          : { ok: true, stdout: "0041 0042\n", stderr: "" };
      },
    });

    const payload = JSON.parse(stdout.text) as {
      result: string;
      checkedCodepoints: string[];
      missingCodepoints: string[];
    };
    expect(payload.result).toBe("pass");
    expect(payload.checkedCodepoints).toEqual(["U+0041", "U+0042"]);
    expect(payload.missingCodepoints).toEqual([]);
    expectNoStderr();
  });

  test("rejects unreadable or invalid UTF-8 font check text files before discovery", async () => {
    const fixtureDir = await createTempFixtureDir("font-check-invalid-text");
    const invalidPath = join(fixtureDir, "invalid.txt");
    await writeFile(invalidPath, Buffer.from([0xc3, 0x28]));
    const { runtime, expectNoOutput } = createActionTestRuntime();
    let called = false;
    const runner = async () => {
      called = true;
      return { ok: true, stdout: "", stderr: "" };
    };

    await expectCliError(
      () => actionFontCheck(runtime, { family: "Latin", textFile: invalidPath, runner }),
      {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Invalid UTF-8 in --text-file",
      },
    );
    await expectCliError(
      () =>
        actionFontCheck(runtime, {
          family: "Latin",
          textFile: join(fixtureDir, "missing.txt"),
          runner,
        }),
      {
        code: "FILE_READ_ERROR",
        exitCode: 2,
        messageIncludes: "Failed to read --text-file",
      },
    );

    expect(called).toBe(false);
    expectNoOutput();
  });
});
