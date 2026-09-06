import {
  outputPlan,
  synthesizeForPlan,
  signalsForPlan,
  commandStateForSignals,
} from "./bundle-write-fixtures";
import { describe, expect, test } from "bun:test";
import { basename } from "node:path";
import { createMdPdfTemplateCodexReportArtifact } from "../../../../src/cli/markdown-pdf/template-codex";
import { createCapturedRuntime } from "../../../helpers/cli-test-utils";

describe("cli action modules: md pdf-template codex bundle writes", () => {
  test("redacts Windows absolute paths outside cwd in diagnostic reports", async () => {
    const plan = outputPlan({
      outputDirectory: "/repo/bundle",
      reportPath: "D:\\private\\report.json",
    });
    const signals = signalsForPlan(plan);
    const { runtime } = createCapturedRuntime({ cwd: "C:\\repo" });
    const report = createMdPdfTemplateCodexReportArtifact({
      outputPlan: plan,
      runtime,
      signals,
      state: {
        ...commandStateForSignals(signals),
        baseProfilePath: "D:\\private\\profile.yml",
        inputPath: "D:\\private\\source.md",
      },
      synthesis: synthesizeForPlan(plan),
    });

    expect(report.input.markdown).toMatchObject({
      basename: "source.md",
      display: "source.md",
      redacted: true,
    });
    expect(report.baseProfile.source).toMatchObject({
      basename: "profile.yml",
      display: "profile.yml",
      redacted: true,
    });
    expect(report.files.find((file) => file.role === "diagnostic-report")?.path).toBe(
      "report.json",
    );
    expect(JSON.stringify(report)).not.toContain("private");
  });
});
