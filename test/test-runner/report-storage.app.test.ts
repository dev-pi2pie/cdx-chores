import { describe, expect, test } from "bun:test";
import { link, mkdir, readFile, rename, symlink, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { prepareReport, readReport } from "../../scripts/testing/reports/report-storage";
import { allocateRun, runPath } from "../../scripts/testing/ownership/run-context";
import { withTempFixtureDir } from "../helpers/cli-test-utils";

const selected = ["test/example.unit.test.ts"];
const xml =
  '<testsuites tests="1" assertions="1" failures="0" skipped="0" time="0.1"><testsuite tests="1" assertions="1" failures="0" skipped="0" time="0.1" file="test/example.unit.test.ts"><testcase name="works" assertions="1" time="0.1" /></testsuite></testsuites>';

describe("owned JUnit report storage", () => {
  test("consumes a fresh report from exactly its selected testcase owner", async () => {
    await withTempFixtureDir("report-storage", async (root) => {
      const run = await allocateRun(root, ["unit"], false);
      const ticket = await prepareReport(run, "unit");
      await writeFile(ticket.path, xml, { flag: "wx" });
      expect(await readReport(run, ticket, selected)).toMatchObject({
        tests: 1,
        assertions: 1,
        files: selected,
      });
    });
  });

  test("rejects earlier reports before launch, including a symlink", async () => {
    await withTempFixtureDir("report-storage", async (root) => {
      const run = await allocateRun(root, ["unit", "app"], false);
      await writeFile(runPath(run, "results/unit.junit.xml"), xml);
      await expect(prepareReport(run, "unit")).rejects.toThrow("pre-existing");
      await symlink(runPath(run, "results/unit.junit.xml"), runPath(run, "results/app.junit.xml"));
      await expect(prepareReport(run, "app")).rejects.toThrow("pre-existing");
    });
  });

  test("rejects missing, stale, empty, and directory reports", async () => {
    await withTempFixtureDir("report-storage", async (root) => {
      const run = await allocateRun(root, ["unit", "app", "codex", "pandoc"], false);
      const missing = await prepareReport(run, "unit");
      await expect(readReport(run, missing, selected)).rejects.toMatchObject({ code: "ENOENT" });
      const stale = await prepareReport(run, "app");
      await writeFile(stale.path, xml);
      await utimes(stale.path, new Date(0), new Date(0));
      await expect(readReport(run, stale, selected)).rejects.toThrow("stale");
      const empty = await prepareReport(run, "codex");
      await writeFile(empty.path, "");
      await expect(readReport(run, empty, selected)).rejects.toThrow("regular file");
      const directory = await prepareReport(run, "pandoc");
      await mkdir(directory.path);
      await expect(readReport(run, directory, selected)).rejects.toThrow("regular file");
    });
  });

  test("refuses report aliases and replacement of the results namespace", async () => {
    await withTempFixtureDir("report-storage", async (root) => {
      const run = await allocateRun(root, ["unit", "app"], false);
      const ticket = await prepareReport(run, "unit");
      const unrelated = join(root, "unrelated.xml");
      await writeFile(unrelated, xml);
      await symlink(unrelated, ticket.path);
      await expect(readReport(run, ticket, selected)).rejects.toThrow("symbolic links");
      const app = await prepareReport(run, "app");
      await rename(runPath(run, "results"), runPath(run, "old-results"));
      await mkdir(runPath(run, "results"));
      await writeFile(app.path, xml);
      await expect(readReport(run, app, selected)).rejects.toThrow("namespace was replaced");
    });
  });

  test("rejects a hard-linked report without changing its other owner", async () => {
    await withTempFixtureDir("report-storage", async (root) => {
      const run = await allocateRun(root, ["unit"], false);
      const ticket = await prepareReport(run, "unit");
      const outside = join(root, "other-owner.xml");
      await writeFile(outside, xml);
      await link(outside, ticket.path);
      await expect(readReport(run, ticket, selected)).rejects.toThrow("independent regular file");
      expect(await readFile(outside, "utf8")).toBe(xml);
    });
  });
});
