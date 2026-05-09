import {
  readFile,
  writeFile,
  join,
  describe,
  expect,
  test,
  seedDataExtractFixtures,
  seedStackedMergedBandFixture,
  runCli,
  toRepoRelativePath,
  withTempFixtureDir,
  fixturePath,
  duckdbReady,
  excelReady,
} from "./cli-command-data-extract.helpers";

describe("CLI data extract command Excel shape", () => {
  test("extracts an explicit Excel range end to end when the extension is ready", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "summary.tsv");

      const result = runCli([
        "data",
        "extract",
        fixturePath("multi.xlsx"),
        "--source",
        "Summary",
        "--range",
        "A1:B3",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote TSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe("id\tname\n1\tAda\n2\tBob\n");
    });
  });

  test("extracts an Excel source-shape artifact with reviewed header-row end to end", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const artifactPath = join(fixtureDir, "shape.json");
      const outputPath = join(fixtureDir, "messy.clean.csv");
      await writeFile(
        artifactPath,
        `${JSON.stringify(
          {
            input: {
              format: "excel",
              path: toRepoRelativePath(inputPath),
              source: "Summary",
            },
            metadata: {
              artifactType: "data-source-shape",
              issuedAt: "2026-03-18T00:00:00.000Z",
            },
            shape: {
              headerRow: 7,
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
        "extract",
        toRepoRelativePath(inputPath),
        "--source-shape",
        toRepoRelativePath(artifactPath),
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "ID,item,status,description\n1001,Starter,active,Initial package\n1002,Expansion,paused,Requires follow-up\n1003,Renewal,active,Ready to ship\n1004,Archive,draft,Awaiting approval\n",
      );
    });
  });

  test("extracts a shaped Excel header-band workbook end to end after tolerant import retry", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "header-band.xlsx");
      const outputPath = join(fixtureDir, "header-band.clean.csv");

      const result = runCli([
        "data",
        "extract",
        toRepoRelativePath(inputPath),
        "--source",
        "Summary",
        "--range",
        "B7:E12",
        "--header-row",
        "7",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "ID,question,status,notes\n101,Confirm tax residency,open,Email pending\n102,Collect withholding certificate,closed,Received\n103,Review dividend statement,open,Waiting on broker\n",
      );
    });
  });

  test("extracts the public stacked merged-band workbook end to end when body-start-row is provided", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedStackedMergedBandFixture(fixtureDir);
      const inputPath = join(fixtureDir, "stacked-merged-band.xlsx");
      const outputPath = join(fixtureDir, "stacked-merged-band.clean.csv");

      const result = runCli([
        "data",
        "extract",
        toRepoRelativePath(inputPath),
        "--source",
        "Sheet1",
        "--range",
        "B7:BR20",
        "--body-start-row",
        "10",
        "--header-row",
        "7",
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "id,question,status,notes\n1,Does the customer need a follow-up call after the outage review?,- [ ] Yes; - [ ] No,callback\n2,Is there any pending refund evidence that finance still needs to verify?,- [ ] Yes; - [ ] No,refund\n3,Do we already have the replacement tracking number from the warehouse?,- [ ] Yes; - [ ] No,tracking\n4,Did legal approve the latest waiver wording for the support response?,- [ ] Yes; - [ ] No,waiver\n5,Should billing pause the renewal invoice until the dispute is closed?,- [ ] Yes; - [ ] No,renewal\n6,Has the onboarding checklist been resent to the implementation contact?,- [ ] Yes; - [ ] No,onboarding\n7,Do we need another maintenance window before the migration can resume?,- [ ] Yes; - [ ] No,maintenance\n8,Is there a signed change request covering the expanded delivery scope?,- [ ] Yes; - [ ] No,change\n9,Has procurement confirmed the revised purchase order for the hardware?,- [ ] Yes; - [ ] No,procurement\n10,Do we still need security sign-off for the temporary access exception?,- [ ] Yes; - [ ] No,security\n11,Should the account remain in watch status until the next leadership review?,- [ ] Yes; - [ ] No,watch\n",
      );
    });
  });
});
