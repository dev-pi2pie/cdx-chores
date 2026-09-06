import { describe, expect, test } from "bun:test";

import {
  ANSI_ESCAPE,
  enableTty,
  expectAnsi,
  expectNoAnsi,
  runDataPreview,
  withDataPreviewFixture,
} from "./support";
import { stripAnsi } from "../../helpers/ansi";

const HIGHLIGHTED_ACTIVE_PATTERN = new RegExp(
  `${ANSI_ESCAPE}\\[[0-9;]*mactive\\s*${ANSI_ESCAPE}\\[[0-9;]*m`,
);
const ANSI_SEQUENCE_PATTERN = `${ANSI_ESCAPE}\\[[0-9;]*m`;
const STYLED_INPUT_PATTERN = new RegExp(
  `(?:${ANSI_SEQUENCE_PATTERN})+Input(?:${ANSI_SEQUENCE_PATTERN})+`,
);
const STYLED_NAME_PATTERN = new RegExp(
  `(?:${ANSI_SEQUENCE_PATTERN})+name(?:${ANSI_SEQUENCE_PATTERN})+`,
);

describe("cli action modules: data preview tty behavior", () => {
  test("actionDataPreview highlights matching cells in TTY mode when contains filters are visible", async () => {
    await withDataPreviewFixture({
      content: "name,status,region\nAda,active,tw\nBob,paused,tw\n",
      fileName: "highlight.csv",
      run: async ({ expectNoStderr, runtime, stdout, ...context }) => {
        enableTty(runtime, 80);
        await runDataPreview(
          { ...context, runtime },
          {
            contains: ["status:active"],
          },
        );

        expectNoStderr();
        expectAnsi(stdout.text);
        expect(stdout.text).toMatch(HIGHLIGHTED_ACTIVE_PATTERN);
        expect(stripAnsi(stdout.text)).toContain("Ada  | active | tw");
        expect(stripAnsi(stdout.text)).not.toContain("Contains highlight:");
      },
    });
  });

  test("actionDataPreview does not add match highlighting in non-TTY mode", async () => {
    await withDataPreviewFixture({
      content: "name,status\nAda,active\n",
      fileName: "highlight.csv",
      run: async ({ expectNoStderr, stdout, ...context }) => {
        await runDataPreview(context, {
          contains: ["status:active"],
        });

        expectNoStderr();
        expectNoAnsi(stdout.text);
      },
    });
  });

  test("actionDataPreview notes hidden matching columns instead of forcing them visible", async () => {
    await withDataPreviewFixture({
      content: "id,name,status,region\n1,Ada,active,tw\n2,Bob,active,jp\n",
      fileName: "hidden-highlight.csv",
      run: async ({ expectNoStderr, runtime, stdout, ...context }) => {
        enableTty(runtime, 80);
        await runDataPreview(
          { ...context, runtime },
          {
            columns: ["id", "name"],
            contains: ["status:active"],
          },
        );

        expectNoStderr();
        const plain = stripAnsi(stdout.text);
        expect(plain).toContain("Visible columns: id, name");
        expect(plain).toContain("Contains highlight: hidden matching columns: status");
        expect(plain).not.toContain("status |");
      },
    });
  });

  test("actionDataPreview bounds visible columns in narrow TTY mode", async () => {
    await withDataPreviewFixture({
      content: "id,status,message,owner,region\n1,ok,hello,ada,tw\n",
      fileName: "wide.csv",
      run: async ({ expectNoStderr, runtime, stdout, ...context }) => {
        enableTty(runtime, 18);
        await runDataPreview({ ...context, runtime });

        expectNoStderr();
        const plain = stripAnsi(stdout.text);
        expect(plain).toContain("Visible columns: id, status, message (+2 hidden)");
        expect(plain).toContain("id  | status | me...");
        expect(plain).not.toContain("owner");
      },
    });
  });

  test("actionDataPreview styles summary labels and header cells in TTY mode", async () => {
    await withDataPreviewFixture({
      content: "name,age\nAda,36\n",
      fileName: "rows.csv",
      run: async ({ expectNoStderr, runtime, stdout, ...context }) => {
        enableTty(runtime, 80);
        await runDataPreview({ ...context, runtime });

        expectNoStderr();
        expect(stdout.text).toMatch(STYLED_INPUT_PATTERN);
        expect(stdout.text).toMatch(STYLED_NAME_PATTERN);
      },
    });
  });

  test("actionDataPreview omits ANSI styling in TTY mode when color is disabled", async () => {
    await withDataPreviewFixture({
      content: "name,age\nAda,36\n",
      fileName: "rows.csv",
      run: async ({ expectNoStderr, runtime, stdout, ...context }) => {
        enableTty(runtime, 80);
        await runDataPreview({ ...context, runtime });

        expectNoStderr();
        expectNoAnsi(stdout.text);
      },
      runtimeOptions: { colorEnabled: false },
    });
  });

  test("actionDataPreview omits match highlighting in TTY mode when color is disabled", async () => {
    await withDataPreviewFixture({
      content: "name,status\nAda,active\n",
      fileName: "rows.csv",
      run: async ({ expectNoStderr, runtime, stdout, ...context }) => {
        enableTty(runtime, 80);
        await runDataPreview(
          { ...context, runtime },
          {
            contains: ["status:active"],
          },
        );

        expectNoStderr();
        expectNoAnsi(stdout.text);
      },
      runtimeOptions: { colorEnabled: false },
    });
  });
});
