import type { HarnessRunnerContext } from "../../helpers/interactive-harness/context";

export function createDoctorActionMock(context: HarnessRunnerContext) {
  return {
    actionDoctor: async (_runtime: unknown, options: Record<string, unknown>) => {
      context.recordAction("doctor", options);
    },
  };
}
