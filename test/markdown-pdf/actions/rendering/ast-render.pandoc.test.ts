import { describe, test } from "bun:test";
import { basename } from "node:path";

import { registerFixtureOutput } from "../../../../scripts/testing/fixtures/fixture-exports";
import { withPandocFixtureDir } from "../../pandoc-support";
import { astRenderFixtures, verifyAstRenderFixture } from "./ast-render-fixtures";

describe("Markdown PDF shared render through Pandoc", () => {
  test.each(astRenderFixtures)(
    "$name",
    async (fixture) => {
      await withPandocFixtureDir("md-pdf-ast-render", async (dir, runPandoc) => {
        const output = await verifyAstRenderFixture(
          dir,
          async (args) => {
            const result = await runPandoc(args);
            return {
              ok: result.ok,
              code: result.exitCode,
              signal: null,
              stdout: result.stdout,
              stderr: result.stderr,
            };
          },
          fixture,
        );
        registerFixtureOutput(dir, {
          source: output,
          name: basename(output),
          kind: "generated",
          required: true,
        });
      });
    },
    20_000,
  );
});
