import { describe, expect, test } from "bun:test";

import { runDataPreview, withDataPreviewFixture } from "./helpers";

describe("cli action modules: data preview", () => {
  test("actionDataPreview renders CSV summary and table output", async () => {
    await withDataPreviewFixture({
      content: "name,age\nAda,36\nBob,28\n",
      fileName: "rows.csv",
      run: async ({ expectNoStderr, stdout, ...context }) => {
        await runDataPreview(context);

        expectNoStderr();
        expect(stdout.text).toContain(`Input: ${context.input}`);
        expect(stdout.text).toContain("Format: csv");
        expect(stdout.text).toContain("Rows: 2");
        expect(stdout.text).toContain("Window: 1-2 of 2");
        expect(stdout.text).toContain("Visible columns: name, age");
        expect(stdout.text).toContain("name | age");
        expect(stdout.text).toContain("Ada  | 36 ");
      },
    });
  });

  test("actionDataPreview renders TSV summary and table output", async () => {
    await withDataPreviewFixture({
      content: "name\tage\nAda\t36\nBob\t28\n",
      fileName: "rows.tsv",
      run: async ({ expectNoStderr, stdout, ...context }) => {
        await runDataPreview(context);

        expectNoStderr();
        expect(stdout.text).toContain(`Input: ${context.input}`);
        expect(stdout.text).toContain("Format: tsv");
        expect(stdout.text).toContain("Rows: 2");
        expect(stdout.text).toContain("Window: 1-2 of 2");
        expect(stdout.text).toContain("Visible columns: name, age");
        expect(stdout.text).toContain("name | age");
        expect(stdout.text).toContain("Ada  | 36 ");
      },
    });
  });

  test("actionDataPreview preserves first-seen key order across heterogeneous JSON rows", async () => {
    await withDataPreviewFixture({
      content:
        '[{"name":"Ada","age":36},{"name":"Bob","status":"active"},{"status":"pending","city":"Taipei"}]\n',
      fileName: "rows.json",
      run: async ({ expectNoStderr, stdout, ...context }) => {
        await runDataPreview(context);

        expectNoStderr();
        expect(stdout.text).toContain("Visible columns: name, age, status, city");
        expect(stdout.text).toContain("name | age | status");
        expect(stdout.text).toContain("city");
      },
    });
  });

  test("actionDataPreview uses value column fallback for scalar arrays", async () => {
    await withDataPreviewFixture({
      content: '["Ada", 36, true]\n',
      fileName: "scalar-array.json",
      run: async ({ expectNoStderr, stdout, ...context }) => {
        await runDataPreview(context);

        expectNoStderr();
        expect(stdout.text).toContain("Visible columns: value");
        expect(stdout.text).toContain("value");
        expect(stdout.text).toContain("Ada");
        expect(stdout.text).toContain("36");
        expect(stdout.text).toContain("true");
      },
    });
  });

  test("actionDataPreview normalizes blank CSV headers and extends rows wider than the header", async () => {
    await withDataPreviewFixture({
      content: "name,\nAda,36,admin\n",
      fileName: "odd.csv",
      run: async ({ expectNoStderr, stdout, ...context }) => {
        await runDataPreview(context);

        expectNoStderr();
        expect(stdout.text).toContain("Visible columns: name, column_2, column_3");
        expect(stdout.text).toContain("name | column_2 | column_3");
        expect(stdout.text).toContain("Ada");
        expect(stdout.text).toContain("36");
        expect(stdout.text).toContain("admin");
      },
    });
  });

  test("actionDataPreview reports empty CSV deterministically", async () => {
    await withDataPreviewFixture({
      content: "",
      fileName: "empty.csv",
      run: async ({ expectNoStderr, stdout, ...context }) => {
        await runDataPreview(context);

        expectNoStderr();
        expect(stdout.text).toContain("Rows: 0");
        expect(stdout.text).toContain("Window: 0 rows at offset 0");
        expect(stdout.text).toContain("Visible columns: (none)");
        expect(stdout.text).toContain("(no columns to display)");
      },
    });
  });

  test("actionDataPreview applies column filtering and row windowing", async () => {
    await withDataPreviewFixture({
      content:
        '[{"id":1,"name":"Ada","status":"active"},{"id":2,"name":"Bob","status":"paused"},{"id":3,"name":"Cyd","status":"draft"}]\n',
      fileName: "window.json",
      run: async ({ expectNoStderr, stdout, ...context }) => {
        await runDataPreview(context, {
          columns: ["id", "status"],
          offset: 1,
          rows: 1,
        });

        expectNoStderr();
        expect(stdout.text).toContain("Window: 2-2 of 3");
        expect(stdout.text).toContain("Visible columns: id, status");
        expect(stdout.text).toContain("paused");
        expect(stdout.text).not.toContain("Ada");
        expect(stdout.text).not.toContain("draft");
      },
    });
  });

  test("actionDataPreview filters rows with case-insensitive contains matching", async () => {
    await withDataPreviewFixture({
      content: "name,status\nAda,Active\nBob,paused\nCyd,REACTIVE\n",
      fileName: "contains.csv",
      run: async ({ expectNoStderr, stdout, ...context }) => {
        await runDataPreview(context, {
          contains: ["status:act"],
        });

        expectNoStderr();
        expect(stdout.text).toContain("Rows: 2");
        expect(stdout.text).toContain("Window: 1-2 of 2");
        expect(stdout.text).toContain("Ada");
        expect(stdout.text).toContain("Cyd");
        expect(stdout.text).not.toContain("Bob");
      },
    });
  });

  test("actionDataPreview applies contains filters before offset and row slicing", async () => {
    await withDataPreviewFixture({
      content:
        '[{"id":1,"status":"active","region":"tw"},{"id":2,"status":"paused","region":"tw"},{"id":3,"status":"active","region":"jp"},{"id":4,"status":"ACTIVE","region":"tw"}]\n',
      fileName: "contains-window.json",
      run: async ({ expectNoStderr, stdout, ...context }) => {
        await runDataPreview(context, {
          contains: ["status:active", "region:tw"],
          offset: 1,
          rows: 1,
        });

        expectNoStderr();
        expect(stdout.text).toContain("Rows: 2");
        expect(stdout.text).toContain("Window: 2-2 of 2");
        expect(stdout.text).toContain("4   | ACTIVE | tw");
        expect(stdout.text).not.toContain("1   | active | tw");
        expect(stdout.text).not.toContain("2   | paused | tw");
        expect(stdout.text).not.toContain("3   | active | jp");
      },
    });
  });

  test("actionDataPreview supports escaped colons in contains columns and keywords", async () => {
    await withDataPreviewFixture({
      content: '[{"meta:key":"api:v1","name":"Ada"},{"meta:key":"api:v2","name":"Bob"}]\n',
      fileName: "escaped-colon.json",
      run: async ({ expectNoStderr, stdout, ...context }) => {
        await runDataPreview(context, {
          contains: ["meta\\:key:api\\:v1"],
        });

        expectNoStderr();
        expect(stdout.text).toContain("Rows: 1");
        expect(stdout.text).toContain("Ada");
        expect(stdout.text).not.toContain("Bob");
      },
    });
  });

  test("actionDataPreview supports escaped backslashes in contains keywords", async () => {
    await withDataPreviewFixture({
      content: "path,label\nC:\\logs\\app,Ada\nC:\\tmp\\else,Bob\n",
      fileName: "escaped-backslash.csv",
      run: async ({ expectNoStderr, stdout, ...context }) => {
        await runDataPreview(context, {
          contains: ["path:C:\\\\logs\\\\app"],
        });

        expectNoStderr();
        expect(stdout.text).toContain("Rows: 1");
        expect(stdout.text).toContain("C:\\logs\\app");
        expect(stdout.text).not.toContain("C:\\tmp\\else");
      },
    });
  });
});
