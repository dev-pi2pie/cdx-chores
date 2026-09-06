export type CodexInfoView = "summary" | "models" | "providers";

export interface CodexDiscoveryContext {
  cwd: string;
  codexVersion: string;
  codexHome: string;
  codexHomeSource: "environment" | "default";
}

/** Internal protocol data. Never serialize this object directly to user output. */
export interface CodexDiscovery {
  context: CodexDiscoveryContext;
  config: Record<string, unknown>;
  models: unknown[] | null;
}

export interface CodexDiscoveryOptions {
  cwd: string;
  view: CodexInfoView;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  /** Overall discovery deadline; the CLI uses the 30-second default. */
  timeoutMs?: number;
}
