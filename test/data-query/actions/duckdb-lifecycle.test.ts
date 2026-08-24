import { describe, test } from "bun:test";

import { actionDataDuckDbExtensionInstall } from "../../../src/cli/actions";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";

describe("data query DuckDB lifecycle action", () => {
  test("actionDataDuckDbExtensionInstall requires an extension name unless --all-supported is used", async () => {
    const { runtime, expectNoOutput } = createActionTestRuntime();

    await expectCliError(() => actionDataDuckDbExtensionInstall(runtime, {}), {
      code: "INVALID_INPUT",
      exitCode: 2,
      messageIncludes: "Extension name is required unless --all-supported is used",
    });

    expectNoOutput();
  });
});
