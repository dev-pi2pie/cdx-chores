import { openSync, writeSync, closeSync } from "node:fs";
import { parseArgs } from "node:util";
import { slugifyName } from "../../src/utils/slug";
import { resolvePathPromptRuntimeConfig } from "../../src/cli/prompts/path-config";
import { resolveCliColorEnabled } from "../../src/cli/colors";
import { promptFramePicker } from "../../src/cli/interactive/video-frames/picker";
import { enterFrameValue } from "../../src/cli/interactive/video-frames/simple-prompts";
import {
  effectiveFrameSerial,
  promptFrameNaming,
  promptFrameSetPreset,
  type FrameNamingMode,
} from "../../src/cli/interactive/video-frames/naming";
import {
  type FrameIdentity,
  type FramePickerState,
  type FrameRequest,
} from "../../src/cli/interactive/video-frames/selection";
import { SMALL_TIMING_FIXTURES } from "./video-frames/fixtures.ts";

// Development-only entry. Bundle with target=node for real terminal verification.
// There is no source-media argument and no executable decoder/export backend.
const { values } = parseArgs({
  options: {
    mode: { type: "string", default: "picker" },
    fixture: { type: "string", default: "shifted-variable-timing" },
    trace: { type: "string" },
    initial: { type: "string" },
    simple: { type: "boolean" },
    "no-color": { type: "boolean" },
    "unknown-dimensions": { type: "boolean" },
    "unsupported-raw": { type: "boolean" },
    "follow-up": { type: "boolean" },
    "resolve-failure": { type: "boolean" },
    "slow-resolve": { type: "boolean" },
  },
});
const fixture =
  SMALL_TIMING_FIXTURES.find((item) => item.id === values.fixture) ??
  (() => {
    throw new Error("Choose a declared synthetic fixture.");
  })();
const trace = values.trace ? openSync(values.trace, "wx", 0o600) : undefined;
const record = (value: unknown) => {
  if (trace !== undefined)
    writeSync(
      trace,
      JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)) +
        "\n",
    );
};
const operation = new AbortController();
const interrupt = () => operation.abort();
process.on("SIGINT", interrupt);
process.on("SIGTERM", interrupt);
const io = { input: process.stdin, output: process.stdout, signal: operation.signal };
const colorEnabled = resolveCliColorEnabled({ noColorFlag: values["no-color"] });
const keypressListeners = process.stdin.listenerCount("keypress");
const resizeListeners = process.stdout.listenerCount("resize");
let resolveCalls = 0;
record({ kind: "started", pid: process.pid, runtime: process.version });

const identity = (frameNumber: number): FrameIdentity => {
  if (frameNumber > fixture.verifiedFrameCount)
    throw new Error("Synthetic source frame is out of range.");
  const absolute = fixture.absoluteStartsMs[frameNumber - 1];
  const origin = fixture.absoluteStartsMs[0];
  return {
    frameNumber,
    ...(absolute != null && origin != null ? { startMs: absolute - origin } : {}),
  };
};

async function resolveSynthetic(
  request: FrameRequest,
  signal: AbortSignal,
): Promise<FrameIdentity> {
  resolveCalls++;
  record({ kind: "resolve", request, resolveCalls });
  if (values["slow-resolve"])
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        reject(new Error("Synthetic resolution cancelled."));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      }, 2_000);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
  if (values["resolve-failure"]) throw new Error("Synthetic resolution failure.");
  if (request.kind === "first") return identity(1);
  if (request.kind === "last") return identity(fixture.verifiedFrameCount);
  if (request.kind === "frame") return identity(request.frameNumber);
  if (fixture.reliableEndMs == null || fixture.absoluteStartsMs.some((start) => start == null))
    throw new Error("Synthetic time selection lacks reliable timing/end.");
  if (request.timeMs.numerator >= BigInt(fixture.reliableEndMs) * request.timeMs.denominator)
    throw new Error("Synthetic timestamp is at/after the reliable end.");
  let selected = 1;
  fixture.absoluteStartsMs.forEach((start, index) => {
    if (
      BigInt(start! - fixture.absoluteStartsMs[0]!) * request.timeMs.denominator <=
      request.timeMs.numerator
    )
      selected = index + 1;
  });
  return identity(selected);
}

function namingPreview(
  mode: FrameNamingMode,
  settings: { template: string; serialStart?: number; serialWidth?: number },
) {
  const serial = effectiveFrameSerial(settings);
  const roles =
    mode === "set" ? ["first", "middle", "last"] : mode === "sequence" ? ["", "", ""] : ["custom"];
  const stem = slugifyName("Synthetic Clip.v2").slice(0, 48);
  return roles.map(
    (role, index) =>
      settings.template
        .replace(/\{([^{}]+)\}/g, (_match, token: string) => {
          if (token === "stem") return stem;
          if (token === "selection") return role;
          if (token === "frame")
            return String(
              mode === "set"
                ? (fixture.firstMiddleLast?.[index] ?? fixture.firstLast[Math.min(index, 1)])
                : index < 2
                  ? 1
                  : fixture.verifiedFrameCount,
            );
          return String(serial.start + index).padStart(serial.width, "0");
        })
        .replace(/--+/g, "-") + ".png",
  );
}

try {
  if (values["unknown-dimensions"]) {
    process.stdout.columns = undefined as unknown as number;
    process.stdout.rows = undefined as unknown as number;
  }
  if (values["unsupported-raw"])
    process.stdin.setRawMode = undefined as unknown as typeof process.stdin.setRawMode;
  let result: unknown;
  if (values.mode === "picker") {
    const initialState: FramePickerState | undefined =
      values.initial === "precise"
        ? {
            request: { kind: "time", timeMs: { numerator: 1234n, denominator: 1n } },
            resolved: identity(3),
            glyphs: "unicode",
          }
        : values.initial === "frame-no-time"
          ? {
              request: { kind: "frame", frameNumber: 1 },
              resolved: { frameNumber: 1 },
              glyphs: "unicode",
            }
          : undefined;
    result = await promptFramePicker({
      ...io,
      initialState,
      durationMs: fixture.metadataDurationMs ?? undefined,
      simple: values.simple || resolvePathPromptRuntimeConfig().mode === "simple",
      sourceLabel: "Synthetic clip",
      colorEnabled,
      resolve: resolveSynthetic,
      onChange: (observation) => record({ kind: "observation", ...observation }),
    });
  } else if (values.mode === "set") {
    const preset = await promptFrameSetPreset(io);
    const frames =
      preset === "first-last"
        ? fixture.firstLast
        : preset === "first-middle-last"
          ? fixture.firstMiddleLast
          : null;
    if (preset && !frames) throw new Error("Synthetic preset requires a reliable midpoint/end.");
    result = {
      preset,
      frames,
      roles:
        preset === "first-last" ? ["first", "last"] : preset ? ["first", "middle", "last"] : [],
    };
  } else if (["single", "set-naming", "sequence"].includes(values.mode!)) {
    const mode: FrameNamingMode =
      values.mode === "set-naming" ? "set" : (values.mode as "single" | "sequence");
    const settings = await promptFrameNaming({ ...io, simple: values.simple, colorEnabled }, mode);
    result = settings ? { ...settings, names: namingPreview(mode, settings) } : null;
  } else throw new Error("Choose picker, set, single, set-naming, or sequence prototype mode.");
  record({ kind: "selected", result, resolveCalls });
  if (values["follow-up"]) {
    record({ kind: "follow-up" });
    await enterFrameValue(io, {
      message: "Next ordinary prompt",
      validate: (value) => (value === "ready" ? true : "Enter ready."),
    });
  }
  const restored = {
    rawMode: process.stdin.isRaw === true,
    keypressListeners: process.stdin.listenerCount("keypress") - keypressListeners,
    resizeListeners: process.stdout.listenerCount("resize") - resizeListeners,
  };
  record({ kind: "final", restored, resolveCalls });
  process.stdout.write(
    `\nPrototype result: ${JSON.stringify({ result, restored, resolveCalls }, (_key, item) => (typeof item === "bigint" ? item.toString() : item))}\n`,
  );
} catch (error) {
  const restored = {
    rawMode: process.stdin.isRaw === true,
    keypressListeners: process.stdin.listenerCount("keypress") - keypressListeners,
    resizeListeners: process.stdout.listenerCount("resize") - resizeListeners,
  };
  record({ kind: "error", message: (error as Error).message, restored, resolveCalls });
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = (error as Error).name === "ExitPromptError" ? 130 : 1;
} finally {
  process.off("SIGINT", interrupt);
  process.off("SIGTERM", interrupt);
  if (trace !== undefined) closeSync(trace);
}
