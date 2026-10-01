import { dirname, join, resolve } from "node:path";
import {
  prepareVideoFrames,
  executePreparedVideoFrames,
  inspectVideoFramesTools,
  withVideoFramesSignal,
} from "../../actions/video-frames";
import { displayPath } from "../../actions/shared";
import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import { FrameNamer } from "../../video-frames/naming";
import { FrameResolver } from "../../video-frames/resolver";
import type { VideoFramesOptions } from "../../video-frames/options";
import type { ImageSelection } from "../../video-frames/images";
import type { FrameRequest, FrameSetPreset, ResolvedFrame } from "../../video-frames/types";
import type { InteractivePathPromptContext } from "../shared";
import { promptFrameSetPreset } from "./naming";
import { fatalFrameFailure, runFrameWork } from "./operation";
import { promptFramePicker } from "./picker";
import { frameReviewTitle, printFrameReview } from "./review";
import {
  promptFrameCadence,
  promptFrameImageSettings,
  promptFramePath,
  type FrameImageSettings,
} from "./settings";
import { chooseFrameOption } from "./simple-prompts";
import type { FramePickerState } from "./selection";

export interface FrameWorkflowPrompts {
  choose: typeof chooseFrameOption;
  path: typeof promptFramePath;
  picker: typeof promptFramePicker;
  preset: typeof promptFrameSetPreset;
  cadence: typeof promptFrameCadence;
  settings: typeof promptFrameImageSettings;
  /** Read-only observation seam for controlled review/export identity verification. */
  onReview?: (prepared: Awaited<ReturnType<typeof prepareVideoFrames>>) => void;
}
const defaults: FrameWorkflowPrompts = {
  choose: chooseFrameOption,
  path: promptFramePath,
  picker: promptFramePicker,
  preset: promptFrameSetPreset,
  cadence: promptFrameCadence,
  settings: promptFrameImageSettings,
};

export async function handleVideoFramesInteractive(
  runtime: CliRuntime,
  pathContext: InteractivePathPromptContext,
  implementations: Partial<FrameWorkflowPrompts> = {},
): Promise<void> {
  if (!runtime.stdin.isTTY || !(runtime.stdout as NodeJS.WriteStream).isTTY)
    throw new CliError(
      "Use direct video frames CLI options when no interactive terminal is available.",
      { code: "FRAME_TTY_REQUIRED", exitCode: 2 },
    );
  const prompts = { ...defaults, ...implementations };
  await withVideoFramesSignal(async (signal) => {
    const io = {
      input: runtime.stdin,
      output: runtime.stdout,
      signal,
      simple: pathContext.runtimeConfig.mode === "simple",
      colorEnabled: runtime.colorEnabled,
    };
    try {
      sourceLoop: for (;;) {
        const input = await prompts.path(io, pathContext, "Source video", "file");
        if (input === undefined) return;
        const source = resolve(runtime.cwd, input);
        let scanProgress: ((frames: number) => void) | undefined;
        const resolver = new FrameResolver(source, {
          progress: (frames) => scanProgress?.(frames),
        });
        const work = async <T>(label: string, body: (signal: AbortSignal) => Promise<T>) => {
          try {
            return await runFrameWork(io, label, body, (update) => {
              scanProgress = update;
            });
          } finally {
            scanProgress = undefined;
          }
        };
        let encoders: Awaited<ReturnType<typeof inspectVideoFramesTools>>;
        try {
          const inspected = await work("Inspecting video", async (taskSignal) => {
            const tools = await inspectVideoFramesTools(runtime, taskSignal);
            await resolver.prepareSequence(taskSignal);
            return tools;
          });
          if (!inspected) return;
          encoders = inspected;
        } catch (error) {
          if (
            fatalFrameFailure(error) ||
            signal.aborted ||
            (error instanceof CliError && error.exitCode === 130)
          )
            throw error;
          runtime.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
          const next = await prompts.choose(
            io,
            "Video inspection failed",
            [
              { name: "Choose another source", value: "source" },
              { name: "Cancel", value: "cancel" },
            ],
            "cancel",
          );
          if (next === "source") continue;
          return;
        }
        let mode: "single" | "set" | "sequence" = "single";
        let selections: readonly ImageSelection[] | undefined;
        let selector: Partial<VideoFramesOptions> = {};
        let pickerState: FramePickerState | undefined;
        let settings: FrameImageSettings | undefined;
        let stage: "selection" | "settings" = "selection";
        for (;;) {
          try {
            if (stage === "selection") {
              const selectedMode = await prompts.choose(
                io,
                "Frames to export",
                [
                  { name: "One frame", value: "single" },
                  { name: "Frame set", value: "set" },
                  { name: "Sequence (whole video)", value: "sequence" },
                  { name: "Back to source", value: "source" },
                  { name: "Cancel", value: "cancel" },
                ],
                "source",
              );
              if (selectedMode === "source") continue sourceLoop;
              if (selectedMode === "cancel") return;
              if (selectedMode !== mode) {
                settings = undefined;
                selections = undefined;
                selector = {};
              }
              mode = selectedMode;
              if (mode === "single") {
                const method = await prompts.choose(
                  io,
                  "Choose a source frame",
                  [
                    { name: "First", value: "first" },
                    { name: "Last", value: "last" },
                    { name: "Custom: timeline / frame / time", value: "custom" },
                    { name: "Back", value: "back" },
                  ],
                  "back",
                );
                if (method === "back") continue;
                if (method === "custom") {
                  const end = resolver.state.endMs ?? resolver.state.metadata?.estimatedDurationMs;
                  const duration = end
                    ? Number((end.numerator + end.denominator - 1n) / end.denominator)
                    : undefined;
                  const result = await prompts.picker({
                    ...io,
                    initialState: pickerState,
                    durationMs: Number.isSafeInteger(duration) ? duration : undefined,
                    sourceLabel: displayPath(runtime, source),
                    resolve: async (request, taskSignal, progress) => {
                      scanProgress = progress;
                      try {
                        return await resolver.resolve(request, taskSignal);
                      } finally {
                        scanProgress = undefined;
                      }
                    },
                  });
                  if (!result) continue;
                  pickerState = result;
                  selections = [
                    { selection: "custom", identity: result.resolved as ResolvedFrame },
                  ];
                  selector = { frameNumber: result.resolved.frameNumber };
                } else {
                  const request: FrameRequest = { kind: method };
                  const identity = await work("Resolving frame", (taskSignal) =>
                    resolver.resolve(request, taskSignal),
                  );
                  if (!identity) continue;
                  selections = [{ identity, selection: method }];
                  selector = method === "first" ? { firstFrame: true } : { lastFrame: true };
                  pickerState = undefined;
                }
              } else if (mode === "set") {
                const preset = await prompts.preset(io);
                if (!preset) continue;
                const roles = await work("Resolving frame set", (taskSignal) =>
                  resolver.resolveSet(preset as FrameSetPreset, taskSignal),
                );
                if (!roles) continue;
                selections = roles;
                selector = { frameSet: preset };
                pickerState = undefined;
              } else {
                const cadence = await prompts.cadence(
                  io,
                  resolver.state.endMs ?? resolver.state.metadata?.estimatedDurationMs,
                );
                if (!cadence) continue;
                selector = cadence;
                selections = undefined;
                pickerState = undefined;
              }
              stage = "settings";
            }
            const nextSettings = await prompts.settings(io, pathContext, mode, encoders, settings);
            if (!nextSettings) {
              stage = "selection";
              continue;
            }
            settings = nextSettings;
            let output = settings.destination.path;
            if (mode === "single" && settings.destination.kind !== "file") {
              const namer = new FrameNamer("single", source, settings.naming);
              const selected = selections![0]!;
              const name = namer.name({
                frameNumber: selected.identity.frameNumber,
                selection: selected.selection,
                format: settings.format,
              });
              output = join(
                settings.destination.kind === "folder"
                  ? resolve(runtime.cwd, output!)
                  : dirname(source),
                name,
              );
            }
            const prepared = await work("Preparing export review", (taskSignal) =>
              prepareVideoFrames(
                runtime,
                {
                  input: source,
                  ...selector,
                  format: settings!.format,
                  quality: settings!.quality,
                  scale: settings!.scale,
                  output,
                  overwrite: settings!.overwrite,
                  ...(mode === "single"
                    ? {}
                    : {
                        pattern: settings!.naming?.template,
                        serialStart: settings!.naming?.serialStart,
                        serialWidth: settings!.naming?.serialWidth,
                      }),
                },
                { resolver, selections, signal: taskSignal },
              ),
            );
            if (!prepared) continue;
            reviewLoop: for (;;) {
              printFrameReview(
                runtime,
                prepared,
                pickerState,
                settings.destination.kind === "file" ? "explicit" : settings.naming,
              );
              prompts.onReview?.(prepared);
              const decision = await prompts.choose(
                io,
                frameReviewTitle(prepared),
                [
                  { name: "Export", value: "export" },
                  { name: "Change settings", value: "settings" },
                  { name: "Change selection", value: "selection" },
                  { name: "Choose another source", value: "source" },
                  { name: "Cancel", value: "cancel" },
                ],
                "cancel",
              );
              if (decision === "cancel") return;
              if (decision === "source") continue sourceLoop;
              if (decision === "settings" || decision === "selection") {
                stage = decision;
                break reviewLoop;
              }
              const result = await work("Exporting images", (taskSignal) =>
                executePreparedVideoFrames(runtime, prepared, taskSignal),
              );
              if (result) return;
            }
          } catch (error) {
            if (
              fatalFrameFailure(error) ||
              signal.aborted ||
              (error instanceof CliError && error.exitCode === 130)
            )
              throw error;
            runtime.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
            if (
              error instanceof CliError &&
              ["FRAME_SOURCE_CHANGED", "FRAME_STREAM_CHANGED"].includes(error.code)
            ) {
              runtime.stderr.write("Source or stream changed; choose the source again.\n");
              continue sourceLoop;
            }
            const recovery = await prompts.choose(
              io,
              "Frame export needs attention",
              [
                { name: "Change settings", value: "settings" },
                { name: "Select again", value: "selection" },
                { name: "Choose another source", value: "source" },
                { name: "Cancel", value: "cancel" },
              ],
              "cancel",
            );
            if (recovery === "cancel") return;
            if (recovery === "source") continue sourceLoop;
            stage = selections || mode === "sequence" ? recovery : "selection";
          }
        }
      }
    } catch (error) {
      if (fatalFrameFailure(error)) throw error;
      if (
        signal.aborted ||
        (error instanceof Error && /ExitPromptError|AbortPromptError/.test(error.name))
      )
        throw new CliError("Interactive frame export cancelled.", {
          code: "PROCESS_CANCELLED",
          exitCode: 130,
        });
      throw error;
    }
  }, runtime.stdin);
}
