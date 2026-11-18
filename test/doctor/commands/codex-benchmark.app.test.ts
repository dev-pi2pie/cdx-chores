import { expect, test } from "bun:test";

import { actionDoctor } from "../../../src/cli/actions/doctor";
import { inspectCodexBenchmark } from "../../../src/cli/doctor/codex-benchmark";
import { withRunnerFixture } from "../../codex-benchmark/fixtures/runner";
import { createActionTestRuntime } from "../../helpers/cli-action-test-utils";
import { createDoctorFixture } from "../fixtures";

test.each([
  ["0.170.0", "met"],
  ["0.170.0+local", "met"],
  ["1.0.0", "met"],
  ["0.169.9", "unverified"],
  ["0.170.0-beta.1", "unverified"],
  [null, "unverified"],
] as const)(
  "doctor checks app-server version %s using only initialization",
  async (version, status) => {
    await withRunnerFixture({ appServerVersion: version }, async ({ options, trace }) => {
      const check = await inspectCodexBenchmark(options.cwd, options.env);
      expect(check).toMatchObject({ status, version, minimumVersion: "0.170.0" });
      const methods = (await trace()).map(({ method }) => method);
      expect(methods[0]).toBe("initialize");
      expect(methods.every((method) => method === "initialize" || method === "initialized")).toBe(
        true,
      );
    });
  },
);

test("doctor renders a failed initialization as a local diagnostic while retaining workflow checks", async () => {
  await withRunnerFixture({ initializeError: true }, async ({ options, trace }) => {
    const fixture = createDoctorFixture();
    for (const output of ["summary", "details", "json"]) {
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
      await actionDoctor(runtime, {
        details: output === "details",
        json: output === "json",
        inspectors: {
          ...fixture.inspectors,
          inspectCodexBenchmark: () => inspectCodexBenchmark(options.cwd, options.env),
        },
      });
      expectNoStderr();
      if (output === "json") {
        const report = JSON.parse(stdout.text);
        expect(report.codexBenchmark).toMatchObject({
          status: "failed",
          version: null,
          detail: expect.stringContaining("`app-server`"),
        });
        expect(report.capabilities["data.query.codex"]).toBe(true);
      } else {
        expect(stdout.text).toContain("Codex benchmark local prerequisites: failed");
        expect(stdout.text).toContain("Run the selected Codex executable with `app-server`");
      }
    }
    expect((await trace()).map(({ method }) => method)).toEqual(Array(3).fill("initialize"));
  });
});
