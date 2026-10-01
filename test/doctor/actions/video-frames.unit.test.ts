import { describe, expect, test } from "bun:test";
import { actionDoctor } from "../../../src/cli/actions/doctor";
import type { DependencyCommandRunner } from "../../../src/cli/deps";
import type { ExecCommandResult } from "../../../src/cli/process";
import { unknownImageEncoders, type ImageEncoders } from "../../../src/cli/video-frames/encoders";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";
import { createDoctorFixture, DOCTOR_FIXTURE_ENCODERS } from "../fixtures";

const inventory = "Encoders:\n V..... png PNG\n V..... mjpeg JPG\n V..... libwebp WebP\n";
const help =
  "Encoder libwebp [WebP]:\n Supported pixel formats: bgra yuv420p\nlibwebp AVOptions:\n -lossless <int> mode (from 0 to 1)\n";
const ok = (stdout: string): ExecCommandResult => ({
  ok: true,
  code: 0,
  signal: null,
  stdout,
  stderr: "",
});
type View = "summary" | "details" | "json";

function runDoctor(
  view: View,
  options: {
    ffmpeg?: boolean;
    ffprobe?: boolean;
    ffprobeFailure?: boolean;
    inventory?: string;
    help?: string;
    version?: string;
    failure?: "inventory" | "help";
    failureResult?: ExecCommandResult;
  } = {},
) {
  const calls: Array<{ command: string; args: string[] }> = [];
  const fixture = createDoctorFixture();
  const { runtime, stdout, expectNoStderr } = createActionTestRuntime({ colorEnabled: false });
  const runner: DependencyCommandRunner = async (command, args) => {
    calls.push({ command, args });
    if (command === "ffprobe" && options.ffprobeFailure)
      throw new Error("controlled FFprobe permission failure");
    if (
      (command === "ffmpeg" && options.ffmpeg === false) ||
      (command === "ffprobe" && options.ffprobe === false)
    )
      throw new Error(`spawn ${command} ENOENT`);
    const probe = args.includes("-encoders")
      ? "inventory"
      : args.includes("encoder=libwebp")
        ? "help"
        : undefined;
    if (probe === options.failure && probe) {
      if (options.failureResult) return options.failureResult;
      throw new Error("controlled encoder probe failed");
    }
    if (probe === "inventory") return ok(options.inventory ?? inventory);
    if (probe === "help") return ok(options.help ?? help);
    if (command === "ffmpeg" || command === "ffprobe")
      return ok(options.version ?? `${command} version 8.0.1\n`);
    if (command === "pandoc") return ok("pandoc 3.9\n");
    if (command === "weasyprint") return ok("WeasyPrint version 68.0\n");
    return ok("fontconfig version 2.15.0\n");
  };
  const run = () =>
    actionDoctor(runtime, {
      details: view === "details",
      json: view === "json",
      dependencyRunner: runner,
      inspectors: {
        inspectCodexEnvironment: fixture.inspectors.inspectCodexEnvironment,
        inspectDataQueryExtensions: fixture.inspectors.inspectDataQueryExtensions,
      },
    });
  return { calls, stdout, expectNoStderr, run };
}

describe("doctor advertised video frames support", () => {
  for (const [ffmpeg, ffprobe, state] of [
    [true, true, "ready"],
    [true, false, "limited"],
    [false, true, "unavailable"],
    [false, false, "unavailable"],
  ] as const) {
    test.each(["summary", "details", "json"] as const)(
      `FFmpeg=${ffmpeg}, FFprobe=${ffprobe} in %s`,
      async (view) => {
        const fixture = await runDoctor(view, { ffmpeg, ffprobe });
        await fixture.run();
        fixture.expectNoStderr();
        expect(fixture.calls.filter((call) => call.args.includes("-encoders"))).toHaveLength(
          ffmpeg ? 1 : 0,
        );
        expect(fixture.calls.filter((call) => call.args.includes("encoder=libwebp"))).toHaveLength(
          ffmpeg ? 1 : 0,
        );
        expect(fixture.calls.filter((call) => call.command === "ffprobe")).toEqual([
          { command: "ffprobe", args: ["-version"] },
        ]);
        if (view === "json") {
          const payload = JSON.parse(fixture.stdout.text);
          expect(Object.keys(payload.tools)).toEqual(["pandoc", "ffmpeg", "ffprobe", "weasyprint"]);
          expect(payload.tools.ffprobe.available).toBe(ffprobe);
          expect(payload.capabilities["video.frames"]).toBe(ffmpeg && ffprobe);
          for (const capability of ["video.convert", "video.resize", "video.gif"])
            expect(payload.capabilities[capability]).toBe(ffmpeg);
          expect(payload.videoFrames.encoders).toEqual(
            ffmpeg ? DOCTOR_FIXTURE_ENCODERS : unknownImageEncoders(),
          );
        } else if (view === "summary") {
          expect(fixture.stdout.text).toContain(`Video: ${state}`);
          if (!ffprobe) {
            expect(fixture.stdout.text).toContain("FFprobe is required for video frames");
            expect(fixture.stdout.text).toContain(
              "Check FFprobe installation and PATH for video frames [required]",
            );
          }
          if (!ffmpeg) expect(fixture.stdout.text).toContain("FFmpeg is missing");
        } else {
          expect(fixture.stdout.text).toContain(
            `- ffprobe: ${ffprobe ? "available (8.0.1)" : "missing"}`,
          );
          expect(fixture.stdout.text).toContain(
            `- video.frames: ${ffmpeg && ffprobe ? "available" : "unavailable"}`,
          );
        }
      },
    );
  }

  const cases: Array<{
    name: string;
    inventory?: string;
    help?: string;
    expected: ImageEncoders;
    state: string;
  }> = [
    {
      name: "missing PNG entry",
      inventory: inventory.replace(" V..... png PNG\n", ""),
      expected: { ...DOCTOR_FIXTURE_ENCODERS, png: "unsupported" },
      state: "limited",
    },
    {
      name: "missing JPG entry",
      inventory: inventory.replace(" V..... mjpeg JPG\n", ""),
      expected: { ...DOCTOR_FIXTURE_ENCODERS, jpg: "unsupported" },
      state: "limited",
    },
    {
      name: "animated WebP is insufficient",
      inventory: inventory.replace("libwebp WebP", "libwebp_anim animated WebP"),
      expected: {
        ...DOCTOR_FIXTURE_ENCODERS,
        webp: "unsupported",
        webpEncoder: "unsupported",
        webpBgra: "unsupported",
        webpLossless: "unsupported",
      },
      state: "limited",
    },
    {
      name: "WebP lacks BGRA",
      help: help.replace("bgra yuv420p", "yuv420p yuva420p"),
      expected: { ...DOCTOR_FIXTURE_ENCODERS, webp: "unsupported", webpBgra: "unsupported" },
      state: "limited",
    },
    {
      name: "lossless option absent",
      help: help.replace(
        " -lossless <int> mode (from 0 to 1)",
        " -quality <float> quality (from 0 to 100)",
      ),
      expected: { ...DOCTOR_FIXTURE_ENCODERS, webpLossless: "unsupported" },
      state: "limited",
    },
    {
      name: "unrecognized inventory",
      inventory: "PNG, mjpeg, libwebp and lossless mentioned incidentally\n",
      expected: unknownImageEncoders(),
      state: "unknown",
    },
    {
      name: "unrecognized help",
      help: "Codec libwebp not recognized. bgra lossless\n",
      expected: {
        ...DOCTOR_FIXTURE_ENCODERS,
        webp: "unknown",
        webpBgra: "unknown",
        webpLossless: "unknown",
      },
      state: "unknown",
    },
    {
      name: "unrecognized lossless range",
      help: help.replace("(from 0 to 1)", "(unknown range)"),
      expected: { ...DOCTOR_FIXTURE_ENCODERS, webpLossless: "unknown" },
      state: "unknown",
    },
    {
      name: "pixel formats absent",
      help: help.replace(" Supported pixel formats: bgra yuv420p\n", ""),
      expected: { ...DOCTOR_FIXTURE_ENCODERS, webp: "unknown", webpBgra: "unknown" },
      state: "unknown",
    },
  ];
  for (const scenario of cases) {
    test.each(["summary", "details", "json"] as const)(`${scenario.name} in %s`, async (view) => {
      const fixture = await runDoctor(view, scenario);
      await fixture.run();
      fixture.expectNoStderr();
      if (view === "json") {
        const payload = JSON.parse(fixture.stdout.text);
        expect(payload.capabilities["video.frames"]).toBe(true);
        expect(payload.capabilities["video.convert"]).toBe(true);
        expect(payload.videoFrames.encoders).toEqual(scenario.expected);
      } else if (view === "summary") {
        expect(fixture.stdout.text).toContain(`Video: ${scenario.state}`);
        expect(fixture.stdout.text).toContain(
          scenario.state === "limited"
            ? "encoder support is unavailable"
            : "encoder support could not be verified",
        );
      } else {
        expect(fixture.stdout.text).toContain(`- PNG (png): ${scenario.expected.png}`);
        expect(fixture.stdout.text).toContain(`- Still WebP (libwebp): ${scenario.expected.webp}`);
        expect(fixture.stdout.text).toContain(`- WebP BGRA input: ${scenario.expected.webpBgra}`);
        expect(fixture.stdout.text).toContain(
          `- WebP full (lossless): ${scenario.expected.webpLossless}`,
        );
      }
      expect(fixture.calls.filter((call) => call.args.includes("-encoders"))).toHaveLength(1);
      expect(fixture.calls.filter((call) => call.args.includes("encoder=libwebp"))).toHaveLength(
        scenario.expected.webpEncoder === "supported" ? 1 : 0,
      );
    });
  }

  test("unparsed FFmpeg/FFprobe versions remain unknown without changing executable capability", async () => {
    for (const view of ["details", "json"] as const) {
      const fixture = await runDoctor(view, { version: "custom tool output\n" });
      await fixture.run();
      if (view === "json") {
        const payload = JSON.parse(fixture.stdout.text);
        expect(payload.tools.ffmpeg.version).toBeNull();
        expect(payload.tools.ffprobe.version).toBeNull();
        expect(payload.capabilities["video.frames"]).toBe(true);
      } else {
        expect(fixture.stdout.text).toContain("ffmpeg: available (unknown version)");
        expect(fixture.stdout.text).toContain("ffprobe: available (unknown version)");
      }
    }
  });

  for (const failure of ["inventory", "help"] as const) {
    test.each(["summary", "details", "json"] as const)(
      `${failure} operational failure emits no partial %s report`,
      async (view) => {
        const fixture = await runDoctor(view, { failure });
        await expectCliError(fixture.run, { code: "FRAME_ENCODER_INSPECTION_FAILED", exitCode: 2 });
        expect(fixture.stdout.text).toBe("");
        fixture.expectNoStderr();
      },
    );
  }

  test.each(["summary", "details", "json"] as const)(
    "FFprobe operational failure emits no partial %s report",
    async (view) => {
      const fixture = runDoctor(view, { ffprobeFailure: true });
      await expectCliError(fixture.run, {
        code: "DEPENDENCY_CHECK_FAILED",
        exitCode: 2,
        messageIncludes: "FFprobe permission failure",
      });
      expect(fixture.stdout.text).toBe("");
      expect(fixture.calls.some((call) => call.args.includes("-encoders"))).toBe(false);
      fixture.expectNoStderr();
    },
  );

  test.each([
    { ...ok(inventory), ok: false, code: 1 },
    { ...ok(inventory), stderr: "probe failed" },
    ok("x".repeat(262_145)),
  ])(
    "rejects failed or over-budget inventory without a capability report",
    async (failureResult) => {
      const fixture = await runDoctor("json", { failure: "inventory", failureResult });
      await expectCliError(fixture.run, { code: "FRAME_ENCODER_INSPECTION_FAILED", exitCode: 2 });
      expect(fixture.stdout.text).toBe("");
    },
  );
});
