import { describe, test } from "bun:test";

import { expectCliError } from "../helpers/cli-action-test-utils";
import { runDataPreview, withDataPreviewFixture } from "./helpers";

describe("cli action modules: data preview failure modes", () => {
  test("actionDataPreview rejects unsupported file types", async () => {
    await withDataPreviewFixture({
      content: "name\nAda\n",
      fileName: "rows.txt",
      run: async ({ expectNoOutput, ...context }) => {
        await expectCliError(() => runDataPreview(context), {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unsupported preview file type:",
        });

        expectNoOutput();
      },
    });
  });

  test("actionDataPreview rejects unknown requested columns", async () => {
    await withDataPreviewFixture({
      content: "name,age\nAda,36\n",
      fileName: "rows.csv",
      run: async ({ expectNoOutput, ...context }) => {
        await expectCliError(
          () =>
            runDataPreview(context, {
              columns: ["status"],
            }),
          {
            code: "INVALID_INPUT",
            exitCode: 2,
            messageIncludes: "Unknown columns: status",
          },
        );

        expectNoOutput();
      },
    });
  });

  test("actionDataPreview rejects unknown contains columns", async () => {
    await withDataPreviewFixture({
      content: "name,age\nAda,36\n",
      fileName: "rows.csv",
      run: async ({ expectNoOutput, ...context }) => {
        await expectCliError(
          () =>
            runDataPreview(context, {
              contains: ["status:active"],
            }),
          {
            code: "INVALID_INPUT",
            exitCode: 2,
            messageIncludes: "Unknown columns: status",
          },
        );

        expectNoOutput();
      },
    });
  });

  test("actionDataPreview rejects malformed contains filters without a separator", async () => {
    await withDataPreviewFixture({
      content: "name,age\nAda,36\n",
      fileName: "rows.csv",
      run: async ({ expectNoOutput, ...context }) => {
        await expectCliError(
          () =>
            runDataPreview(context, {
              contains: ["status"],
            }),
          {
            code: "INVALID_INPUT",
            exitCode: 2,
            messageIncludes: "missing ':' separator",
          },
        );

        expectNoOutput();
      },
    });
  });

  test("actionDataPreview rejects blank contains columns and keywords", async () => {
    await withDataPreviewFixture({
      content: "name,age\nAda,36\n",
      fileName: "rows.csv",
      run: async (context) => {
        await expectCliError(
          () =>
            runDataPreview(context, {
              contains: [":value"],
            }),
          {
            code: "INVALID_INPUT",
            exitCode: 2,
            messageIncludes: "column name cannot be blank",
          },
        );

        await expectCliError(
          () =>
            runDataPreview(context, {
              contains: ["name:"],
            }),
          {
            code: "INVALID_INPUT",
            exitCode: 2,
            messageIncludes: "keyword cannot be blank",
          },
        );
      },
    });
  });

  test("actionDataPreview rejects malformed contains escape sequences", async () => {
    await withDataPreviewFixture({
      content: "name,age\nAda,36\n",
      fileName: "rows.csv",
      run: async ({ expectNoOutput, ...context }) => {
        await expectCliError(
          () =>
            runDataPreview(context, {
              contains: ["name:\\q"],
            }),
          {
            code: "INVALID_INPUT",
            exitCode: 2,
            messageIncludes: "invalid escape sequence \\q",
          },
        );

        await expectCliError(
          () =>
            runDataPreview(context, {
              contains: ["name:value\\"],
            }),
          {
            code: "INVALID_INPUT",
            exitCode: 2,
            messageIncludes: "trailing escape sequence",
          },
        );

        expectNoOutput();
      },
    });
  });

  test("actionDataPreview rejects malformed CSV input", async () => {
    await withDataPreviewFixture({
      content: '"name","age"\n"Ada","36\n',
      fileName: "broken.csv",
      run: async ({ expectNoOutput, ...context }) => {
        await expectCliError(() => runDataPreview(context), {
          code: "INVALID_CSV",
          exitCode: 2,
          messageIncludes: "Invalid CSV:",
        });

        expectNoOutput();
      },
    });
  });

  test("actionDataPreview rejects malformed JSON input", async () => {
    await withDataPreviewFixture({
      content: '{"name":"Ada"\n',
      fileName: "broken.json",
      run: async ({ expectNoOutput, ...context }) => {
        await expectCliError(() => runDataPreview(context), {
          code: "INVALID_JSON",
          exitCode: 2,
          messageIncludes: "Invalid JSON:",
        });

        expectNoOutput();
      },
    });
  });
});
