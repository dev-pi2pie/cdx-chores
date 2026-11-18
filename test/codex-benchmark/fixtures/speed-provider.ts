import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { lifecycleDiagnostic, withLiveCodexFixture } from "../../codex-info/live-fixture";
import { REPO_ROOT } from "../../helpers/cli-test-utils";

const codex = join(REPO_ROOT, "node_modules", ".bin", "codex");
export const fixtureModel = "fixture-speed-model";
export const fixturePrompt = "Reply with fixture-ok.";
export const fixtureAnswer = "fixture-ok";

const catalog = {
  models: [
    {
      slug: fixtureModel,
      display_name: "Fixture speed model",
      base_instructions: "Answer the fixture prompt directly.",
      default_reasoning_level: "low",
      supported_reasoning_levels: [{ effort: "low", description: "Fixture effort" }],
      shell_type: "disabled",
      visibility: "list",
      supported_in_api: true,
      priority: 0,
      service_tiers: [
        { id: "priority", name: "Fast", description: "Fixture Fast tier" },
        { id: "ultrafast", name: "Ultrafast", description: "Fixture Ultrafast tier" },
      ],
      support_verbosity: false,
      truncation_policy: { mode: "tokens", limit: 10_000 },
      experimental_supported_tools: [],
      prefer_websockets: false,
    },
  ],
};

export const speedCases = [
  {
    label: "inherit Fast",
    baseline: "fast",
    selection: undefined,
    appServerTier: undefined,
    wireTier: "priority",
  },
  {
    label: "override Fast with Standard",
    baseline: "fast",
    selection: "default",
    appServerTier: "default",
    wireTier: undefined,
  },
  {
    label: "inherit Standard",
    baseline: "default",
    selection: undefined,
    appServerTier: undefined,
    wireTier: undefined,
  },
  {
    label: "override Standard with Fast",
    baseline: "default",
    selection: "fast",
    appServerTier: "priority",
    wireTier: "priority",
  },
  {
    label: "override Standard with Ultrafast",
    baseline: "default",
    selection: "ultrafast",
    appServerTier: "ultrafast",
    wireTier: "ultrafast",
  },
] as const;

const stream = [
  { type: "response.created", response: { id: "fixture-response" } },
  {
    type: "response.output_item.done",
    item: {
      type: "message",
      id: "fixture-message",
      role: "assistant",
      phase: "final_answer",
      content: [{ type: "output_text", text: fixtureAnswer }],
    },
  },
  {
    type: "response.completed",
    response: {
      id: "fixture-response",
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    },
  },
]
  .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
  .join("");

type Fixture = Parameters<Parameters<typeof withLiveCodexFixture>[0]>[0];
type ProbeFixture = Pick<Fixture, "start" | "close" | "cwd"> & {
  codex: string;
  env: NodeJS.ProcessEnv;
};

export async function captureSpeedRequest(
  baseline: (typeof speedCases)[number]["baseline"],
  exercise: (fixture: ProbeFixture) => Promise<void>,
) {
  const requests: Record<string, unknown>[] = [];
  await withLiveCodexFixture(async ({ root, cwd, env, start, close }) => {
    const home = join(root, "home", ".codex");
    const provider = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        if (request.method !== "POST" || new URL(request.url).pathname !== "/v1/responses") {
          return new Response("Unexpected loopback request", { status: 404 });
        }
        requests.push((await request.json()) as Record<string, unknown>);
        return new Response(stream, { headers: { "content-type": "text/event-stream" } });
      },
    });
    try {
      const catalogPath = join(home, "model-catalog.json");
      await writeFile(catalogPath, JSON.stringify(catalog));
      await writeFile(
        join(home, "config.toml"),
        [
          `model = "${fixtureModel}"`,
          `model_catalog_json = ${JSON.stringify(catalogPath)}`,
          'model_provider = "fixture"',
          `service_tier = "${baseline}"`,
          'web_search = "disabled"',
          "[model_providers.fixture]",
          'name = "Loopback fixture"',
          `base_url = "${provider.url}v1"`,
          'wire_api = "responses"',
          "requires_openai_auth = false",
          "supports_websockets = false",
          "request_max_retries = 0",
          "stream_max_retries = 0",
          "[features]",
          "plugins = false",
          "fast_mode = true",
          "ultrafast_mode = true",
        ].join("\n"),
      );
      await exercise({
        codex,
        cwd,
        env: { ...env, CODEX_HOME: home, NO_PROXY: "127.0.0.1" },
        start,
        close,
      });
    } finally {
      await provider.stop(true);
    }
  });
  return requests;
}

export async function runSdkProbe({ codex, cwd, env, start }: ProbeFixture, selection?: string) {
  const driver = join(REPO_ROOT, "test/codex-benchmark/fixtures/sdk-speed-probe.ts");
  const result = await start({
    executable: process.execPath,
    args: [driver, codex, cwd, fixturePrompt, ...(selection === undefined ? [] : [selection])],
    env,
    timeoutMs: 8_000,
  }).completion;
  if (!result.ok) {
    throw new Error(`SDK probe failed: ${lifecycleDiagnostic(result)}\n${result.stderr}`);
  }
  if (result.stdout.trim() !== fixtureAnswer)
    throw new Error(`Unexpected SDK reply: ${result.stdout}`);
}
