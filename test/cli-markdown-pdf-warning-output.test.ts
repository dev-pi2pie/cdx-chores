import { describe, expect, test } from "bun:test";

import { printMarkdownPdfRenderWarnings } from "../src/cli/actions/markdown/render-warnings";
import { resolveCliColorEnabled } from "../src/cli/colors";
import { createCapturedRuntime } from "./helpers/cli-test-utils";

const ANSI_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*m`, "g");

function setTty(stream: NodeJS.WritableStream, enabled: boolean): void {
  (stream as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = enabled;
}

function renderWarnings(input: {
  colorEnabled?: boolean;
  env?: NodeJS.ProcessEnv;
  stderrTty: boolean;
  stdoutTty: boolean;
}): string {
  const colorEnabled =
    input.env === undefined
      ? (input.colorEnabled ?? true)
      : resolveCliColorEnabled({ env: input.env });
  const { runtime, stderr } = createCapturedRuntime({ colorEnabled });
  setTty(runtime.stdout, input.stdoutTty);
  setTty(runtime.stderr, input.stderrTty);
  printMarkdownPdfRenderWarnings(runtime, ["First warning", "Second warning"]);
  return stderr.text;
}

describe("Markdown PDF warning output", () => {
  test("uses bold yellow only for the heading when stderr is an eligible TTY", () => {
    const output = renderWarnings({ stderrTty: true, stdoutTty: false });

    expect(output).toStartWith(
      "\u001b[1m\u001b[33mMarkdown PDF render warnings:\u001b[39m\u001b[22m\n",
    );
    expect(output).toContain("- First warning\n- Second warning\n");
    expect(output.split("\n")[1]).not.toMatch(ANSI_PATTERN);
    expect(output.split("\n")[2]).not.toMatch(ANSI_PATTERN);
  });

  test("does not use stdout TTY state to color redirected stderr", () => {
    const output = renderWarnings({ stderrTty: false, stdoutTty: true });

    expect(output).toBe("Markdown PDF render warnings:\n- First warning\n- Second warning\n");
    expect(output).not.toMatch(ANSI_PATTERN);
  });

  test.each([
    [
      "--no-color/runtime color disabled",
      { colorEnabled: false, stderrTty: true, stdoutTty: true },
    ],
    ["NO_COLOR", { env: { NO_COLOR: "1" }, stderrTty: true, stdoutTty: true }],
    ["redirected stderr", { stderrTty: false, stdoutTty: false }],
  ] as const)("keeps %s output plain", (_label, options) => {
    const output = renderWarnings(options);

    expect(output).toBe("Markdown PDF render warnings:\n- First warning\n- Second warning\n");
    expect(output).not.toMatch(ANSI_PATTERN);
  });

  test("prints nothing for an empty warning list", () => {
    const { runtime, stderr } = createCapturedRuntime();
    setTty(runtime.stderr, true);

    printMarkdownPdfRenderWarnings(runtime, []);

    expect(stderr.text).toBe("");
  });
});
