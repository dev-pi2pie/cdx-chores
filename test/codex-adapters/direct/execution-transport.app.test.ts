import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmod, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";

// A fresh process prevents another suite's SDK module mock from hiding transport bugs.
function captureArguments(
  executable: string,
  requests: unknown[],
  explicitPath = false,
): string[][] {
  const source = `
    import { startCodexReadOnlyThread } from "./src/adapters/codex/shared.ts";
    const results = [];
    for (const codexExecution of ${JSON.stringify(requests)}) {
      const thread = await startCodexReadOnlyThread(process.cwd(), {
        codexExecution: codexExecution === null ? undefined : codexExecution,
        ${explicitPath ? `codexPathOverride: ${JSON.stringify(executable)},` : ""}
      });
      const result = await thread.run("synthetic transport check");
      results.push(JSON.parse(result.finalResponse));
    }
    process.stdout.write(JSON.stringify(results));
  `;
  return JSON.parse(
    execFileSync(process.execPath, ["--eval", source], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CDX_CHORES_CODEX_PATH: explicitPath ? join(executable, "missing") : executable,
      },
      encoding: "utf8",
      timeout: 10_000,
    }),
  );
}

async function withArgumentRecorder(run: (executable: string) => void): Promise<void> {
  await withTempFixtureDir("codex-execution-transport", async (directory) => {
    const executable = join(directory, "codex-recorder.cjs");
    await writeFile(
      executable,
      `#!/usr/bin/env node
process.stdin.resume();
process.stdin.on("end", () => {
  console.log(JSON.stringify({ type: "item.completed", item: {
    id: "synthetic", type: "agent_message", text: JSON.stringify(process.argv.slice(2))
  }}));
  console.log(JSON.stringify({ type: "turn.completed", usage: {
    input_tokens: 0, cached_input_tokens: 0, output_tokens: 0
  }}));
});
`,
    );
    await chmod(executable, 0o755);
    run(executable);
  });
}

function configArguments(args: string[]): string[] {
  return args.flatMap((argument, index) => (argument === "--config" ? [args[index + 1]!] : []));
}

describe("Codex execution SDK transport", () => {
  test("preserves defaults, factory protections, and inherited service tier", async () => {
    await withArgumentRecorder((executable) => {
      const [args] = captureArguments(executable, [null]);
      expect(args).toBeDefined();
      expect(args!.slice(0, 2)).toEqual(["exec", "--experimental-json"]);
      expect(args).not.toContain("--model");
      expect(args!.slice(args!.indexOf("--sandbox"), args!.indexOf("--sandbox") + 2)).toEqual([
        "--sandbox",
        "read-only",
      ]);
      expect(args![args!.indexOf("--cd") + 1]).toBe(REPO_ROOT);
      expect(configArguments(args!)).toEqual([
        'model_reasoning_effort="low"',
        "sandbox_workspace_write.network_access=true",
        'web_search="disabled"',
        'approval_policy="never"',
      ]);
    });
  });

  test("maps individual and combined overrides without leaking into later invocations", async () => {
    await withArgumentRecorder((executable) => {
      const provider = 'Company_"quoted"\\provider';
      const results = captureArguments(
        executable,
        [
          { model: "Custom/Model" },
          { provider },
          { model: "Other Model", provider: "company", reasoningEffort: "high" },
          null,
        ],
        true,
      );
      expect(results[0]![results[0]!.indexOf("--model") + 1]).toBe("Custom/Model");
      expect(configArguments(results[0]!)).not.toContainEqual(
        expect.stringContaining("model_provider"),
      );
      expect(results[1]).not.toContain("--model");
      expect(configArguments(results[1]!)).toContain(`model_provider=${JSON.stringify(provider)}`);
      expect(results[2]![results[2]!.indexOf("--model") + 1]).toBe("Other Model");
      expect(configArguments(results[2]!)).toContain('model_provider="company"');
      expect(configArguments(results[2]!)).toContain('model_reasoning_effort="high"');
      expect(results[3]).not.toContain("--model");
      expect(configArguments(results[3]!)).toContain('model_reasoning_effort="low"');
      expect(configArguments(results[3]!)).not.toContainEqual(
        expect.stringContaining("model_provider"),
      );
      for (const args of results) {
        expect(args.join("\n")).not.toMatch(/service_tier|fast_mode/);
      }
    });
  });

  test("rejects invalid direct factory inputs before SDK startup", () => {
    const source = `
      import { startCodexReadOnlyThread } from "./src/adapters/codex/shared.ts";
      try {
        await startCodexReadOnlyThread(process.cwd(), {
          codexPathOverride: "/missing-synthetic-codex",
          codexExecution: { reasoningEffort: "unsupported" },
        });
        process.exitCode = 1;
      } catch (error) { process.stdout.write(error.message); }
    `;
    const message = execFileSync(process.execPath, ["--eval", source], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(message).toContain("reasoning");
    expect(message).not.toContain("ENOENT");
  });
});
