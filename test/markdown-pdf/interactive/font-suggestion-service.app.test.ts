import { describe, expect, test } from "bun:test";

import { PassThrough } from "node:stream";

import { createMarkdownPdfInteractiveFontHintSuggestionService } from "../../../src/cli/interactive/markdown/font-hints";
import { createCapturedRuntime } from "../../helpers/cli-test-utils";

import { discoveryResult, promptTick } from "./font-suggestion-support";

class RealPromptInput extends PassThrough {
  isTTY = true;

  setRawMode(): this {
    return this;
  }
}

class NarrowPromptOutput extends PassThrough {
  isTTY = true;
  columns = 36;
}

describe("Markdown PDF Interactive font hint suggestion service", () => {
  test("keeps the pinned real search keyboard contract usable in a narrow terminal", async () => {
    const { runtime } = createCapturedRuntime();
    const stdin = new RealPromptInput();
    const stderr = new NarrowPromptOutput();
    runtime.stdin = stdin as unknown as NodeJS.ReadStream;
    runtime.stderr = stderr;
    const service = createMarkdownPdfInteractiveFontHintSuggestionService(runtime, {
      discover: async () => discoveryResult(["Source Code Pro", "Source Serif 4"]),
    });

    const custom = service.promptPreference();
    await promptTick();
    stdin.write("Source");
    await promptTick();
    stdin.write("\u001b[A");
    await promptTick();
    stdin.write("\r");
    await expect(custom).resolves.toBe("Source");

    const completed = service.promptPreference();
    await promptTick();
    stdin.write("Source");
    await promptTick();
    stdin.write("\u001b[B");
    await promptTick();
    stdin.write("\t");
    await promptTick();
    stdin.write("\r");
    await expect(completed).resolves.toBe("Source Code Pro");

    const unicodePaste = service.promptPreference();
    await promptTick();
    stdin.write("自訂字型");
    await promptTick();
    stdin.write("\r");
    await expect(unicodePaste).resolves.toBe("自訂字型");
  });
});
