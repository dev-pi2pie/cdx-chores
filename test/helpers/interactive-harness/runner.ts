import { createHarnessRunnerContext } from "./context";
import { interactiveDataUrl, interactiveIndexUrl } from "./module-urls";
import { installHarnessMocks } from "./mocks";
import { createHarnessRuntime } from "./runtime";
import type { InteractiveHarnessResult, InteractiveHarnessScenario } from "./types";

function parseScenarioArg(argv: string[]): InteractiveHarnessScenario {
  const rawScenario = argv[2];
  if (!rawScenario) {
    throw new Error("Missing interactive harness scenario JSON.");
  }

  return JSON.parse(rawScenario) as InteractiveHarnessScenario;
}

async function runHarnessScenario(
  scenario: InteractiveHarnessScenario,
): Promise<InteractiveHarnessResult> {
  const context = createHarnessRunnerContext(scenario);
  installHarnessMocks(context);

  const { runtime, stdout, stderr } = createHarnessRuntime({
    nowIsoString: scenario.nowIsoString,
    stdoutColumns: scenario.stdoutColumns,
    stdoutIsTTY: scenario.stdoutIsTTY,
  });

  try {
    if (scenario.mode === "run") {
      const interactiveModule = await import(interactiveIndexUrl);
      await interactiveModule.runInteractiveMode(runtime);
    } else {
      const interactiveDataModule = await import(interactiveDataUrl);
      await interactiveDataModule.handleDataInteractiveAction(
        runtime,
        {
          runtimeConfig: context.mockedPathPromptRuntimeConfig,
          cwd: runtime.cwd,
          stdin: runtime.stdin,
          stdout: runtime.stdout,
        },
        "data:unknown",
      );
    }

    return {
      ...context.result,
      stdout: stdout.text,
      stderr: stderr.text,
    };
  } catch (error) {
    process.exitCode = 1;
    return {
      ...context.result,
      stdout: stdout.text,
      stderr: stderr.text,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const scenario = parseScenarioArg(process.argv);
const result = await runHarnessScenario(scenario);
console.log(JSON.stringify(result));
