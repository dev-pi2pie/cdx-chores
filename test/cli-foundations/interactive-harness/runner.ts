import { createHarnessRunnerContext } from "./context";
import { interactiveIndexUrl } from "./module-urls";
import { installHarnessMocks } from "./mock-composition";
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
    stderrIsTTY: scenario.stderrIsTTY,
    stdoutColumns: scenario.stdoutColumns,
    stdoutIsTTY: scenario.stdoutIsTTY,
  });

  try {
    const interactiveModule = await import(interactiveIndexUrl);
    await interactiveModule.runInteractiveMode(runtime, undefined, {
      codexTimeoutMs: scenario.codexTimeoutMs,
      codexExecution: scenario.codexExecution,
    });

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
