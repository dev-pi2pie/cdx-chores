import { Codex } from "@openai/codex-sdk";

const [codexPathOverride, workingDirectory, prompt, tier] = process.argv.slice(2);
if (!codexPathOverride || !workingDirectory || !prompt)
  throw new Error("Missing SDK probe arguments.");
const env = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);
const codex = new Codex({
  codexPathOverride,
  env,
  ...(tier === undefined ? {} : { config: { service_tier: tier } }),
});
const thread = codex.startThread({
  workingDirectory,
  skipGitRepoCheck: true,
  sandboxMode: "read-only",
  approvalPolicy: "never",
  webSearchMode: "disabled",
});
const turn = await thread.run(prompt, { signal: AbortSignal.timeout(7_000) });
console.log(turn.finalResponse);
