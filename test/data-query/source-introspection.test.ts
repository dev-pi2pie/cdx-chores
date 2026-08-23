import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { renderIntrospectionSummary } from "../../src/cli/interactive/data-query/source-shape";
import { createCapturedRuntime } from "../helpers/cli-test-utils";

function setTty(stream: NodeJS.WritableStream, isTTY: boolean): void {
  (stream as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = isTTY;
}

describe("interactive mode routing: data query source shape", () => {
  test("uses stderr eligibility for source introspection presentation", () => {
    const redirectedStderr = createCapturedRuntime();
    setTty(redirectedStderr.runtime.stdout, true);
    setTty(redirectedStderr.runtime.stderr, false);
    const introspection = {
      columns: [{ name: "id", type: "BIGINT" }],
      sampleRows: [{ id: "1" }],
      truncated: false,
    };

    renderIntrospectionSummary(redirectedStderr.runtime, {
      format: "csv",
      inputPath: join(redirectedStderr.runtime.cwd, "fixtures/query.csv"),
      introspection,
    });

    expect(redirectedStderr.stderr.text).toContain("Input:");
    expect(redirectedStderr.stderr.text).not.toContain("\u001b[");

    const stderrTty = createCapturedRuntime();
    setTty(stderrTty.runtime.stdout, false);
    setTty(stderrTty.runtime.stderr, true);
    renderIntrospectionSummary(stderrTty.runtime, {
      format: "csv",
      inputPath: join(stderrTty.runtime.cwd, "fixtures/query.csv"),
      introspection,
    });

    expect(stderrTty.stderr.text).toContain("\u001b[36mInput\u001b[39m");
  });
});
