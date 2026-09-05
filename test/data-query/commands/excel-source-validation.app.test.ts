import { requireNativePrerequisites } from "../../helpers/native-prerequisites";
import {
  writeFile,
  join,
  describe,
  expect,
  test,
  seedDataExtractFixtures,
  runCli,
  toRepoRelativePath,
  withTempFixtureDir,
  fixturePath,
} from "./support";

describe("CLI data query command source-shape artifacts", () => {
  test("lists available Excel sources when source is missing", async () => {
    await requireNativePrerequisites("excel");

    const result = runCli([
      "data",
      "query",
      fixturePath("multi.xlsx"),
      "--sql",
      "select * from file",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--source is required for Excel");
    expect(result.stderr).toContain("Available sources: Summary, RawData");
  });

  test("reports exact-match failure when a source-shape artifact does not match the current query input", async () => {
    await requireNativePrerequisites("excel");

    await withTempFixtureDir("data-query", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "excel",
              path: "examples/playground/other.xlsx",
              source: "Summary",
            },
            metadata: {
              artifactType: "data-source-shape",
              issuedAt: "2026-03-20T00:00:00.000Z",
            },
            shape: {
              range: "B2:E11",
            },
            version: 1,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const result = runCli([
        "data",
        "query",
        toRepoRelativePath(inputPath),
        "--source-shape",
        toRepoRelativePath(artifactPath),
        "--sql",
        "select * from file",
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain(
        "Source shape artifact does not match the current input context exactly",
      );
    });
  });
});
