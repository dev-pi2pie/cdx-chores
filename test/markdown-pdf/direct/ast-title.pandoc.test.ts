import { describe, test } from "bun:test";
import { basename } from "node:path";

import { registerFixtureOutput } from "../../../scripts/testing/fixtures/fixture-exports";
import { withPandocFixtureDir } from "../pandoc-support";
import { astTitleFixtures, verifyAstTitleFixture } from "./ast-title-fixtures";

describe("Markdown PDF AST title comparison with Pandoc", () => {
  test.each(astTitleFixtures)(
    "$name",
    async (fixture) => {
      await withPandocFixtureDir("md-pdf-ast-title", async (fixtureDir, runPandoc) => {
        const output = await verifyAstTitleFixture(fixtureDir, runPandoc, fixture);
        if (output) {
          registerFixtureOutput(fixtureDir, {
            source: output,
            name: basename(output),
            kind: "generated",
            required: true,
          });
        }
      });
    },
    20_000,
  );
});
