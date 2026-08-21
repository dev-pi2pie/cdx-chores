import { describe, expect, test } from "bun:test";

import { resolveCliColorEnabled } from "../src/cli/colors";
import { styleCliDiagnosticLabel } from "../src/cli/diagnostic-color";
import type { CliRuntime } from "../src/cli/types";
import { createCapturedRuntime } from "./helpers/cli-test-utils";

const ANSI_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*m`, "g");

function setTty(stream: NodeJS.WritableStream, isTTY: boolean): void {
  (stream as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = isTTY;
}

function createRuntime(options: {
  colorEnabled?: boolean;
  stderrIsTTY: boolean;
  stdoutIsTTY: boolean;
}): CliRuntime {
  const { runtime } = createCapturedRuntime({ colorEnabled: options.colorEnabled });
  setTty(runtime.stdout, options.stdoutIsTTY);
  setTty(runtime.stderr, options.stderrIsTTY);
  return runtime;
}

describe("CLI diagnostic colors", () => {
  test("styles only known semantic labels on their eligible target stream", () => {
    const runtime = createRuntime({ stderrIsTTY: true, stdoutIsTTY: true });

    expect(styleCliDiagnosticLabel(runtime, runtime.stderr, "error", "error:")).toBe(
      "\u001b[31merror:\u001b[39m",
    );
    expect(styleCliDiagnosticLabel(runtime, runtime.stderr, "warning", "Warning:")).toBe(
      "\u001b[33mWarning:\u001b[39m",
    );
    expect(styleCliDiagnosticLabel(runtime, runtime.stderr, "notice", "Tip:")).toBe(
      "\u001b[36mTip:\u001b[39m",
    );
    expect(
      styleCliDiagnosticLabel(runtime, runtime.stderr, "unclassified" as never, "Status:"),
    ).toBe("Status:");
  });

  test("checks stdout and stderr eligibility independently", () => {
    const stdoutTtyRuntime = createRuntime({ stderrIsTTY: false, stdoutIsTTY: true });
    expect(
      styleCliDiagnosticLabel(stdoutTtyRuntime, stdoutTtyRuntime.stdout, "notice", "Info:"),
    ).toContain("\u001b[36m");
    expect(
      styleCliDiagnosticLabel(stdoutTtyRuntime, stdoutTtyRuntime.stderr, "warning", "Warning:"),
    ).toBe("Warning:");

    const stderrTtyRuntime = createRuntime({ stderrIsTTY: true, stdoutIsTTY: false });
    expect(
      styleCliDiagnosticLabel(stderrTtyRuntime, stderrTtyRuntime.stdout, "notice", "Info:"),
    ).toBe("Info:");
    expect(
      styleCliDiagnosticLabel(stderrTtyRuntime, stderrTtyRuntime.stderr, "warning", "Warning:"),
    ).toContain("\u001b[33m");
  });

  test("keeps labels plain when runtime color is disabled", () => {
    const runtime = createRuntime({
      colorEnabled: false,
      stderrIsTTY: true,
      stdoutIsTTY: true,
    });

    expect(styleCliDiagnosticLabel(runtime, runtime.stderr, "error", "error:")).toBe("error:");
  });

  test("keeps labels plain when runtime resolution sees NO_COLOR or --no-color", () => {
    const noColorEnvRuntime = createRuntime({
      colorEnabled: resolveCliColorEnabled({ env: { NO_COLOR: "1" } }),
      stderrIsTTY: true,
      stdoutIsTTY: true,
    });
    const noColorFlagRuntime = createRuntime({
      colorEnabled: resolveCliColorEnabled({ noColorFlag: true }),
      stderrIsTTY: true,
      stdoutIsTTY: true,
    });

    expect(
      styleCliDiagnosticLabel(noColorEnvRuntime, noColorEnvRuntime.stderr, "warning", "Warning:"),
    ).toBe("Warning:");
    expect(
      styleCliDiagnosticLabel(noColorFlagRuntime, noColorFlagRuntime.stderr, "notice", "Tip:"),
    ).toBe("Tip:");
  });

  test("preserves canonical plain text when ANSI presentation is stripped", () => {
    const runtime = createRuntime({ stderrIsTTY: true, stdoutIsTTY: false });
    const body = " legacy option remains supported.";
    const rendered = `${styleCliDiagnosticLabel(runtime, runtime.stderr, "warning", "Warning:")}${body}`;

    expect(rendered.replace(ANSI_PATTERN, "")).toBe(`Warning:${body}`);
    expect(body).not.toMatch(ANSI_PATTERN);
  });
});
