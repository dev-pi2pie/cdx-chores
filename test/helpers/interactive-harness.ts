// Compatibility facade for existing tests. The folder module owns the runner
// implementation; internal harness modules should import each other directly.
export { runInteractiveHarness } from "./interactive-harness/index";
export type {
  InteractiveHarnessResult,
  InteractiveHarnessScenario,
} from "./interactive-harness/types";
