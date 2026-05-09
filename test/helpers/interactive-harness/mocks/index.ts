import type { HarnessRunnerContext } from "../context";
import { installActionMocks } from "./actions";
import { installDataQueryMocks } from "./data-query";
import { installFsPromiseMocks } from "./fs";
import { installPathPromptMocks } from "./path-prompts";
import { installPromptMocks } from "./prompts";

export function needsDataQueryMocks(context: HarnessRunnerContext): boolean {
  const selectedDataActions = context.scenario.selectQueue?.filter(
    (value): value is string => typeof value === "string" && value.startsWith("data:"),
  );
  return Boolean(
    selectedDataActions?.some((value) => value === "data:query" || value === "data:extract") ||
    context.scenario.dataQueryDetectedFormat ||
    context.scenario.dataQuerySources ||
    context.scenario.dataQueryIntrospection ||
    context.scenario.dataQueryIntrospectionQueue ||
    context.scenario.dataQueryWorkspaceIntrospection ||
    context.scenario.dataQueryWorkspaceIntrospectionQueue,
  );
}

export function installHarnessMocks(context: HarnessRunnerContext): void {
  installPromptMocks(context);
  installFsPromiseMocks(context);
  installActionMocks(context);
  installPathPromptMocks(context);
  if (needsDataQueryMocks(context)) {
    installDataQueryMocks(context);
  }
}
