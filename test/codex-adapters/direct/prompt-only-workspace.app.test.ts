import { describe, expect, test } from "bun:test";
import { readdir, writeFile } from "node:fs/promises";

import { runCodexPromptOnly } from "../../../src/adapters/codex/shared";

describe("Codex prompt-only workspace lifecycle", () => {
  test("provides an empty disposable directory and removes it after success", async () => {
    let workingDirectory = "";
    const result = await runCodexPromptOnly({
      outputSchema: { type: "object" },
      prompt: "facts only",
      timeoutMs: 1_000,
      work: async (input) => {
        workingDirectory = input.workingDirectory;
        expect(await readdir(input.workingDirectory)).toEqual([]);
        expect(input.prompt).toBe("facts only");
        expect(input.outputSchema).toEqual({ type: "object" });
        await writeFile(`${input.workingDirectory}/scratch.txt`, "temporary", "utf8");
        return "ok";
      },
    });

    expect(result).toBe("ok");
    await expect(readdir(workingDirectory)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("runCodexPromptOnly removes the disposable directory when work throws", async () => {
    let workingDirectory = "";

    await expect(
      runCodexPromptOnly({
        outputSchema: { type: "object" },
        prompt: "facts only",
        timeoutMs: 1_000,
        work: async (input) => {
          workingDirectory = input.workingDirectory;
          await writeFile(`${input.workingDirectory}/scratch.txt`, "temporary", "utf8");
          throw new Error("prompt failed");
        },
      }),
    ).rejects.toThrow("prompt failed");

    await expect(readdir(workingDirectory)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("runCodexPromptOnly removes the disposable directory when the signal aborts", async () => {
    let workingDirectory = "";

    await expect(
      runCodexPromptOnly({
        outputSchema: { type: "object" },
        prompt: "facts only",
        timeoutMs: 1,
        work: async (input) => {
          workingDirectory = input.workingDirectory;
          await writeFile(`${input.workingDirectory}/scratch.txt`, "temporary", "utf8");
          return await new Promise((_resolve, reject) => {
            input.signal.addEventListener("abort", () => {
              reject(new Error("prompt aborted"));
            });
          });
        },
      }),
    ).rejects.toThrow("prompt aborted");

    await expect(readdir(workingDirectory)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
