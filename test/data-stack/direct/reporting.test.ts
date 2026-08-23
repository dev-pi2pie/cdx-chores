import { describe, expect, test } from "bun:test";

import { renderDataStackUnionByNameAliasWarning } from "../../../src/cli/actions/data-stack/reporting";
import { createCapturedRuntime } from "../../helpers/cli-test-utils";

const ANSI_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*m`, "g");
const ANSI_START = `${String.fromCharCode(27)}[`;

describe("CLI data stack command options", () => {
  test("bolds and colors only the canary-alias warning label on eligible stderr", () => {
    const { runtime, stderr } = createCapturedRuntime();
    (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;

    renderDataStackUnionByNameAliasWarning(runtime);

    expect(stderr.text).toBe(
      "\u001b[1m\u001b[33mWarning:\u001b[39m\u001b[22m --union-by-name is a canary compatibility alias. Use --schema-mode union-by-name.\n",
    );
    expect(stderr.text.replace(ANSI_PATTERN, "")).toBe(
      "Warning: --union-by-name is a canary compatibility alias. Use --schema-mode union-by-name.\n",
    );
    expect(stderr.text.slice(stderr.text.indexOf(" --union"))).not.toContain(ANSI_START);
  });
});
