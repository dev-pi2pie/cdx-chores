// Temporary compatibility facade. The canonical implementation lives under
// CLI foundations and consumers move there in the next checkpoint.
export { runInteractiveHarness } from "../cli-foundations/interactive-harness";
export type {
  InteractiveHarnessResult,
  InteractiveHarnessScenario,
} from "../cli-foundations/interactive-harness/types";
