import {
  describe,
  expect,
  test,
  readFile,
  writeFile,
  join,
  actionDataExtract,
  createActionTestRuntime,
  expectCliError,
  seedDataExtractFixtures,
  seedDuckDbWorkspaceFixture,
  seedSingleTableDuckDbFixture,
  REPO_ROOT,
  toRepoRelativePath,
  withTempFixtureDir,
  seedStackedMergedBandFixture,
  dataQueryFixturePath,
  TtyCaptureStream,
  duckdbReady,
  excelReady,
} from "./cli-actions-data-extract.helpers";

describe("cli action modules: data extract source selection", () => {
  test("actionDataExtract applies Excel range shaping before materialization", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "summary.csv");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        input: toRepoRelativePath(dataQueryFixturePath("multi.xlsx")),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        range: "A1:B3",
        source: "Summary",
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe("id,name\n1,Ada\n2,Bob\n");
    });
  });

  test("actionDataExtract materializes a DuckDB-file source", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const outputPath = join(fixtureDir, "users.clean.json");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        source: "users",
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote JSON: ${toRepoRelativePath(outputPath)}`);
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: 1, name: "Ada", status: "active" },
        { id: 2, name: "Bob", status: "paused" },
        { id: 3, name: "Cyd", status: "active" },
      ]);
    });
  });

  test("actionDataExtract materializes a schema-qualified DuckDB source", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const outputPath = join(fixtureDir, "events.clean.csv");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        source: "analytics.events",
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "id,user_id,event_type\n10,1,login\n11,1,export\n12,2,login\n",
      );
    });
  });

  test("actionDataExtract infers the only DuckDB source when the file has one table", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = await seedSingleTableDuckDbFixture(fixtureDir);
      const outputPath = join(fixtureDir, "users.clean.json");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote JSON: ${toRepoRelativePath(outputPath)}`);
      expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual([
        { id: 1, name: "Ada" },
        { id: 2, name: "Bob" },
      ]);
    });
  });

  test("actionDataExtract requires --source for multi-object DuckDB inputs", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const outputPath = join(fixtureDir, "users.clean.json");
      const { runtime, expectNoStdout } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataExtract(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
            overwrite: true,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--source is required for DuckDB query inputs",
        },
      );

      expectNoStdout();
    });
  });

  test("actionDataExtract applies header-row shaping on top of an explicit Excel range", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "messy.xlsx");
      const outputPath = join(fixtureDir, "messy.clean.csv");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        headerRow: 7,
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        range: "B2:E11",
        source: "Summary",
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "ID,item,status,description\n1001,Starter,active,Initial package\n1002,Expansion,paused,Requires follow-up\n1003,Renewal,active,Ready to ship\n1004,Archive,draft,Awaiting approval\n",
      );
    });
  });

  test("actionDataExtract tolerates shaped Excel header-band rows when blank rows follow the header", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedDataExtractFixtures(fixtureDir);
      const inputPath = join(fixtureDir, "header-band.xlsx");
      const outputPath = join(fixtureDir, "header-band.clean.csv");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        headerRow: 7,
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        range: "B7:E12",
        source: "Summary",
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "ID,question,status,notes\n101,Confirm tax residency,open,Email pending\n102,Collect withholding certificate,closed,Received\n103,Review dividend statement,open,Waiting on broker\n",
      );
    });
  });

  test("actionDataExtract materializes the stacked merged-band workbook when body-start-row is provided", async () => {
    if (!excelReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      seedStackedMergedBandFixture(fixtureDir);
      const inputPath = join(fixtureDir, "stacked-merged-band.xlsx");
      const outputPath = join(fixtureDir, "stacked-merged-band.clean.csv");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime();
      await actionDataExtract(runtime, {
        bodyStartRow: 10,
        headerRow: 7,
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
        range: "B7:BR20",
        source: "Sheet1",
      });

      expectNoStdout();
      expect(stderr.text).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe(
        "id,question,status,notes\n1,Does the customer need a follow-up call after the outage review?,- [ ] Yes; - [ ] No,callback\n2,Is there any pending refund evidence that finance still needs to verify?,- [ ] Yes; - [ ] No,refund\n3,Do we already have the replacement tracking number from the warehouse?,- [ ] Yes; - [ ] No,tracking\n4,Did legal approve the latest waiver wording for the support response?,- [ ] Yes; - [ ] No,waiver\n5,Should billing pause the renewal invoice until the dispute is closed?,- [ ] Yes; - [ ] No,renewal\n6,Has the onboarding checklist been resent to the implementation contact?,- [ ] Yes; - [ ] No,onboarding\n7,Do we need another maintenance window before the migration can resume?,- [ ] Yes; - [ ] No,maintenance\n8,Is there a signed change request covering the expanded delivery scope?,- [ ] Yes; - [ ] No,change\n9,Has procurement confirmed the revised purchase order for the hardware?,- [ ] Yes; - [ ] No,procurement\n10,Do we still need security sign-off for the temporary access exception?,- [ ] Yes; - [ ] No,security\n11,Should the account remain in watch status until the next leadership review?,- [ ] Yes; - [ ] No,watch\n",
      );
    });
  });

  test("actionDataExtract reports unknown DuckDB sources clearly", async () => {
    if (!duckdbReady) {
      return;
    }

    await withTempFixtureDir("data-extract", async (fixtureDir) => {
      const inputPath = await seedDuckDbWorkspaceFixture(fixtureDir);
      const outputPath = join(fixtureDir, "missing.clean.json");
      const { runtime } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionDataExtract(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
            overwrite: true,
            source: "analytics.missing",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unknown DuckDB source: analytics.missing",
        },
      );
    });
  });
});
